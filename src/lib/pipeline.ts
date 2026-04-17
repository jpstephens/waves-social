import { db } from "./db";
import { games, highlights, players, posts, teams } from "./db/schema";
import { eq, sql } from "drizzle-orm";
import { extractBoxScore } from "./llm/extract";
import { pickHighlights } from "./llm/highlights";
import { computeRotationBoost } from "./rotation";
import { submitRender, getRenderStatus } from "./shotstack";
import { uploadBufferToBlob } from "./blob";

async function findPlayer(
  teamId: string,
  { name, jerseyNumber }: { name: string; jerseyNumber?: number }
): Promise<{ id: string } | null> {
  const roster = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      jerseyNumber: players.jerseyNumber,
    })
    .from(players)
    .where(eq(players.teamId, teamId));

  // 1. Jersey number is the strongest signal — GameChanger always prints it.
  if (jerseyNumber != null) {
    const byJersey = roster.find((p) => p.jerseyNumber === jerseyNumber);
    if (byJersey) return { id: byJersey.id };
  }

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 2. Parse GameChanger abbreviated format: "L Stephens", "L Stephens #1", "C Labos..." (truncated)
  const clean = name.replace(/#\d+/g, "").replace(/\.\.\.$/, "").trim();
  const tokens = clean.split(/\s+/);
  const target = norm(clean);

  // 2a. Exact full-name match
  const exact = roster.find(
    (p) => norm(`${p.firstName} ${p.lastName ?? ""}`) === target
  );
  if (exact) return { id: exact.id };

  // 2b. First-initial + last-name match ("L Stephens" → Lucas Stephens)
  if (tokens.length >= 2 && tokens[0].length === 1) {
    const initial = norm(tokens[0]);
    const last = norm(tokens.slice(1).join(""));
    const matches = roster.filter(
      (p) =>
        norm(p.firstName).startsWith(initial) &&
        norm(p.lastName ?? "") === last
    );
    if (matches.length === 1) return { id: matches[0].id };
  }

  // 2c. Last-name-only unique match
  const lastToken = tokens[tokens.length - 1];
  if (lastToken) {
    const matches = roster.filter(
      (p) => norm(p.lastName ?? "") === norm(lastToken)
    );
    if (matches.length === 1) return { id: matches[0].id };
  }

  // 2d. First-name unique match (truncated names — PDF "C Labos..." → match roster by first name)
  const firstToken = tokens[0];
  if (firstToken) {
    const matches = roster.filter(
      (p) => norm(p.firstName).startsWith(norm(firstToken))
    );
    if (matches.length === 1) return { id: matches[0].id };
  }

  return null;
}

/**
 * STEP 1: Read the box score, propose a list of post candidates.
 * No posts created, no media generated. Coach reviews and selects from these.
 *
 * Pass `pdfBuffer` to skip re-fetching from Blob (recommended on first run,
 * since private blobs return 403 to bare fetch). If omitted, falls back to
 * fetching the stored URL — works for public blobs only.
 */
export async function proposeHighlights(
  gameId: string,
  pdfBuffer?: Buffer
) {
  const game = (await db.select().from(games).where(eq(games.id, gameId)))[0];
  if (!game) throw new Error(`game ${gameId} not found`);
  if (!game.boxScorePdfUrl && !pdfBuffer) {
    throw new Error("game has no box score PDF");
  }

  const team = (await db.select().from(teams).where(eq(teams.id, game.teamId)))[0];
  if (!team) throw new Error("team not found");

  const roster = await db.select().from(players).where(eq(players.teamId, team.id));

  let buf = pdfBuffer;
  if (!buf) {
    const pdfRes = await fetch(game.boxScorePdfUrl!);
    if (!pdfRes.ok) {
      throw new Error(
        `failed to fetch PDF: ${pdfRes.status} (private Blob URLs are not fetchable without auth — pass pdfBuffer instead)`
      );
    }
    buf = Buffer.from(await pdfRes.arrayBuffer());
  }

  const extracted = await extractBoxScore({
    pdfBuffer: buf,
    coachTeamName: team.name,
  });

  await db
    .update(games)
    .set({
      extractedStats: extracted,
      teamScore: extracted.final.us,
      opponentScore: extracted.final.them,
    })
    .where(eq(games.id, gameId));

  const rotationBoost = computeRotationBoost(roster);
  const picks = await pickHighlights({
    boxScore: extracted,
    roster,
    teamName: team.name,
    rotationBoost,
  });

  const proposedIds: string[] = [];
  for (const pick of picks.picks) {
    const playerRef = await findPlayer(team.id, {
      name: pick.playerName,
      jerseyNumber: pick.jerseyNumber,
    });

    const [h] = await db
      .insert(highlights)
      .values({
        gameId,
        playerId: playerRef?.id,
        status: "proposed",
        kind: pick.kind,
        statLine: pick.statLine,
        headline: pick.headline,
        caption: pick.caption,
        overlayText: pick.overlayText,
        playerNameRaw: pick.playerName,
        jerseyNumber: pick.jerseyNumber,
      })
      .returning();
    proposedIds.push(h.id);
  }

  return { proposedIds };
}

/**
 * STEP 2: Coach selected which proposals to keep. For each selected highlight,
 * create a post and (if a clip is attached) kick off a Shotstack render.
 *
 * This is intentionally separate from proposeHighlights so the coach can curate
 * before any media is generated.
 */
export async function generatePostsForSelected(gameId: string) {
  const game = (await db.select().from(games).where(eq(games.id, gameId)))[0];
  if (!game) throw new Error(`game ${gameId} not found`);
  const team = (await db.select().from(teams).where(eq(teams.id, game.teamId)))[0];
  if (!team) throw new Error("team not found");

  const selected = await db
    .select()
    .from(highlights)
    .where(eq(highlights.gameId, gameId));

  const brand = team.brand ?? { primary: "#0EA5E9", secondary: "#0F172A" };
  const clipUrl = game.clipUrls[0];
  const createdPostIds: string[] = [];

  for (const h of selected) {
    if (h.status !== "selected") continue;

    // Skip if a post already exists for this highlight
    const existing = await db
      .select()
      .from(posts)
      .where(eq(posts.highlightId, h.id));
    if (existing.length > 0) continue;

    const sourceClip = h.sourceMediaUrl ?? clipUrl;

    const [p] = await db
      .insert(posts)
      .values({
        gameId,
        highlightId: h.id,
        kind: "spotlight",
        caption: h.caption,
        status: "draft",
        renderStatus: "pending",
      })
      .returning();
    createdPostIds.push(p.id);

    if (sourceClip && process.env.SHOTSTACK_API_KEY) {
      try {
        const { renderId } = await submitRender({
          clipUrl: sourceClip,
          headline: h.headline,
          overlayText: h.overlayText,
          playerName: h.playerNameRaw ?? "",
          teamName: team.name,
          brand: {
            primary: brand.primary,
            secondary: brand.secondary,
            logoUrl: brand.logoUrl,
          },
        });
        await db
          .update(posts)
          .set({ shotstackRenderId: renderId, renderStatus: "rendering" })
          .where(eq(posts.id, p.id));
      } catch (err) {
        await db
          .update(posts)
          .set({
            renderStatus: "failed",
            errorMessage: err instanceof Error ? err.message : String(err),
          })
          .where(eq(posts.id, p.id));
      }
    }
  }
  return { createdPostIds };
}

export async function pollRenderAndStore(postId: string) {
  const [p] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!p) throw new Error("post not found");
  if (!p.shotstackRenderId) return { status: p.renderStatus };
  if (p.renderStatus === "ready" || p.renderStatus === "failed") {
    return { status: p.renderStatus, url: p.outputVideoUrl };
  }

  const s = await getRenderStatus(p.shotstackRenderId);
  if (s.status === "done" && s.url) {
    const videoRes = await fetch(s.url);
    const videoBuf = Buffer.from(await videoRes.arrayBuffer());
    const { url } = await uploadBufferToBlob({
      buffer: videoBuf,
      pathname: `renders/${p.id}.mp4`,
      contentType: "video/mp4",
    });
    await db
      .update(posts)
      .set({ outputVideoUrl: url, renderStatus: "ready" })
      .where(eq(posts.id, p.id));
    return { status: "ready" as const, url };
  }
  if (s.status === "failed") {
    await db
      .update(posts)
      .set({ renderStatus: "failed", errorMessage: s.error ?? "unknown" })
      .where(eq(posts.id, p.id));
    return { status: "failed" as const, error: s.error };
  }
  return { status: "rendering" as const };
}

export async function approvePost(postId: string) {
  const [p] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!p) throw new Error("post not found");
  if (!p.highlightId) throw new Error("no highlight linked");

  const [h] = await db
    .select()
    .from(highlights)
    .where(eq(highlights.id, p.highlightId));
  if (!h) throw new Error("highlight not found");

  await db.update(posts).set({ status: "approved" }).where(eq(posts.id, postId));

  if (h.playerId) {
    await db
      .update(players)
      .set({ spotlightCount: sql`${players.spotlightCount} + 1` })
      .where(eq(players.id, h.playerId));
  }
}
