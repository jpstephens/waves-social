import { generateObject } from "ai";
import {
  highlightPicksSchema,
  type BoxScoreExtraction,
  type HighlightPicks,
} from "./schemas";
import type { Player } from "../db/schema";

const SYSTEM_PROMPT = `You are a social media assistant for an 8U Little League team.

TONE (non-negotiable):
- Celebrate EFFORT, learning, teamwork. These are 8-year-olds.
- Never shame, compare kids negatively, or imply a player "carried" the team.
- Avoid adult competitive jargon ("dominant", "crushed it", "destroyed"). Prefer "huge hit", "great swing", "strong play".
- Do not invent stats or plays. If a player had a triple, say "triple" — do not upgrade a double to a home run.
- In a loss, lead with individual bright spots and effort. Do not recap the final score in the caption.
- Do not pick the same player twice in one game.

HIGHLIGHT PRIORITY (higher = more worthy of a spotlight post):
1. Home runs (HR) or triples (3B) — always feature.
2. Multi-RBI games (RBI >= 2) or doubles (2B).
3. Strong pitching line (IP >= 3 AND SO >= 3, or ER <= 1).
4. First hit / first walk / first stolen base of the season (coach notes may mention — celebrate as milestones).
5. Multi-hit games (H >= 2).
6. High-effort 1-hit or 1-walk nights — especially for under-featured players.

FAIR ROTATION:
- When two players have comparable stat lines, prefer the one with higher rotation_boost.
- If someone had an extra-base hit, don't skip them even if they've been featured — but keep the headline humble.

OUTPUT:
- Pick 2-4 highlights.
- statLine should read naturally (e.g., "1-for-2, 3B, 2 RBI", "5 IP, 12 K", "2 stolen bases").
- overlayText is shown on the video under the player name — short, factual (e.g., "#15 • 1-for-2, Triple, 2 RBI").
- caption: 2-3 sentences, team voice ("our Waves", "we"), 1-2 tasteful emojis max.
- Always include jerseyNumber when the box score shows one (this is required for roster matching).
- Select at most ONE pitching highlight per game.`;

export async function pickHighlights({
  boxScore,
  roster,
  teamName,
  rotationBoost,
}: {
  boxScore: BoxScoreExtraction;
  roster: Player[];
  teamName: string;
  rotationBoost: Record<string, number>;
}): Promise<HighlightPicks> {
  const rosterContext = roster
    .map(
      (p) =>
        `- ${p.firstName} ${p.lastName ?? ""}`.trim() +
        (p.jerseyNumber ? ` (#${p.jerseyNumber})` : "") +
        ` — spotlights so far: ${p.spotlightCount}, rotation_boost: ${
          rotationBoost[p.id] ?? 0
        }`
    )
    .join("\n");

  const userPrompt = [
    `Team: ${teamName}`,
    `Final: ${boxScore.final.us}-${boxScore.final.them}`,
    `Team narrative: ${boxScore.teamNarrative ?? "(none)"}`,
    ``,
    `Roster and rotation state:`,
    rosterContext,
    ``,
    `Box score player stats:`,
    ...boxScore.players.map((p) => {
      const parts = [
        p.playerName,
        p.jerseyNumber ? `#${p.jerseyNumber}` : "",
        p.position ? `(${p.position})` : "",
        p.atBats != null ? `${p.hits ?? 0}-for-${p.atBats}` : "",
        p.homeRuns ? `${p.homeRuns} HR` : "",
        p.triples ? `${p.triples} 3B` : "",
        p.doubles ? `${p.doubles} 2B` : "",
        p.rbi ? `${p.rbi} RBI` : "",
        p.runs ? `${p.runs} R` : "",
        p.walks ? `${p.walks} BB` : "",
        p.stolenBases ? `${p.stolenBases} SB` : "",
        p.pitchingInnings
          ? `pitched: ${p.pitchingInnings} IP, ${p.pitchingStrikeouts ?? 0} K, ${p.earnedRuns ?? "?"} ER`
          : "",
      ].filter(Boolean);
      return `- ${parts.join(" | ")}`;
    }),
    ``,
    `Pick 2-4 highlights following the rules above.`,
  ].join("\n");

  const { object } = await generateObject({
    model: "anthropic/claude-opus-4-7",
    schema: highlightPicksSchema,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  return object;
}
