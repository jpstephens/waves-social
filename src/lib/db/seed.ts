import "dotenv/config";
import { db, teams, players } from "./index";
import { eq } from "drizzle-orm";

// Real Waves 8U roster (inferred from Apr 11, 2026 box score).
// Fill in correct first names and any missing last-name spellings, then re-run.
const ROSTER: Array<{
  firstName: string;
  lastName?: string;
  jerseyNumber?: number;
  primaryPosition?: string;
}> = [
  { firstName: "Lucas", lastName: "Stephens", jerseyNumber: 1, primaryPosition: "1B" },
  { firstName: "TBD-T", lastName: "Koumoulis", jerseyNumber: 2, primaryPosition: "P" },
  { firstName: "TBD-J", lastName: "Rivera", jerseyNumber: 9, primaryPosition: "3B" },
  { firstName: "TBD-C", lastName: "Labossiere", jerseyNumber: 13, primaryPosition: "CF" },
  { firstName: "TBD-A", lastName: "Fioretti", jerseyNumber: 15, primaryPosition: "SS" },
  { firstName: "TBD-M", lastName: "Roecklein", jerseyNumber: 17, primaryPosition: "RF" },
  { firstName: "TBD-C", lastName: "Lempens", jerseyNumber: 19, primaryPosition: "C" },
  { firstName: "TBD-J", lastName: "Pescuma", jerseyNumber: 21, primaryPosition: "LF" },
  { firstName: "TBD-N", lastName: "Nachmias", jerseyNumber: 31, primaryPosition: "2B" },
];

async function main() {
  const teamName = process.env.SEED_TEAM_NAME ?? "Waves";
  const season = process.env.SEED_TEAM_SEASON ?? "Spring 2026";

  const existing = await db.select().from(teams).where(eq(teams.name, teamName));

  const team =
    existing[0] ??
    (
      await db
        .insert(teams)
        .values({
          name: teamName,
          season,
          ageGroup: "8U",
          brand: {
            primary: "#0EA5E9",
            secondary: "#0F172A",
          },
        })
        .returning()
    )[0];

  console.log(`Team: ${team.name} (${team.id})`);

  const currentPlayers = await db
    .select()
    .from(players)
    .where(eq(players.teamId, team.id));

  if (currentPlayers.length === 0) {
    await db
      .insert(players)
      .values(ROSTER.map((p) => ({ ...p, teamId: team.id })));
    console.log(`Seeded ${ROSTER.length} roster entries.`);
  } else {
    console.log(`Roster already has ${currentPlayers.length} players — skipped.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
