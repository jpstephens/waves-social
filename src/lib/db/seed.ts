import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { db, teams, players } from "./index";
import { eq } from "drizzle-orm";

// Waves 8U full roster.
const ROSTER: Array<{
  firstName: string;
  lastName?: string;
  jerseyNumber?: number;
  primaryPosition?: string;
}> = [
  { firstName: "Luke", lastName: "Stephens", jerseyNumber: 1, primaryPosition: "P" },
  { firstName: "Theo", lastName: "Koumoulis", jerseyNumber: 2, primaryPosition: "P" },
  { firstName: "Owen", lastName: "Henning", jerseyNumber: 3, primaryPosition: "P" },
  { firstName: "Ryan", lastName: "McAward", jerseyNumber: 7 },
  { firstName: "James", lastName: "Rivera", jerseyNumber: 9, primaryPosition: "P" },
  { firstName: "Julian", lastName: "Capeci", jerseyNumber: 12 },
  { firstName: "Christian", lastName: "Labossiere", jerseyNumber: 13 },
  { firstName: "Andrew", lastName: "Fioretti", jerseyNumber: 15, primaryPosition: "P" },
  { firstName: "Mikey", lastName: "Roecklein", jerseyNumber: 17 },
  { firstName: "Christopher", lastName: "Lempenski", jerseyNumber: 19 },
  { firstName: "Jeremy", lastName: "Pescuma", jerseyNumber: 21 },
  { firstName: "Timmy", lastName: "Meahan", jerseyNumber: 23 },
  { firstName: "Noah", lastName: "Nachmias", jerseyNumber: 31 },
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

  // Upsert by jersey number so re-running picks up roster updates.
  let inserted = 0;
  let updated = 0;
  for (const entry of ROSTER) {
    const match = currentPlayers.find(
      (p) => p.jerseyNumber === entry.jerseyNumber
    );
    if (match) {
      await db
        .update(players)
        .set({
          firstName: entry.firstName,
          lastName: entry.lastName,
          primaryPosition: entry.primaryPosition,
        })
        .where(eq(players.id, match.id));
      updated++;
    } else {
      await db.insert(players).values({ ...entry, teamId: team.id });
      inserted++;
    }
  }
  console.log(`Roster: ${inserted} inserted, ${updated} updated.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
