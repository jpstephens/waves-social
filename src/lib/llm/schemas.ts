import { z } from "zod";

export const playerStatSchema = z.object({
  playerName: z
    .string()
    .describe(
      "Name as printed on the box score. GameChanger prints abbreviated names like 'L Stephens' or truncated like 'C Labos...'. Keep whatever form appears."
    ),
  jerseyNumber: z
    .number()
    .int()
    .optional()
    .describe("Jersey number from the '#N' token. This is the reliable ID."),
  position: z
    .string()
    .optional()
    .describe("Position abbreviation inside parens, e.g., 'CF', '1B', 'SS', 'P'"),

  // Batting
  atBats: z.number().int().min(0).optional(),
  hits: z.number().int().min(0).optional(),
  runs: z.number().int().min(0).optional(),
  rbi: z.number().int().min(0).optional(),
  walks: z.number().int().min(0).optional(),
  strikeouts: z.number().int().min(0).optional(),

  // Extra-base hits — parsed from the "2B:", "3B:", "HR:" lines UNDER the batting table
  doubles: z.number().int().min(0).optional(),
  triples: z.number().int().min(0).optional(),
  homeRuns: z.number().int().min(0).optional(),
  totalBases: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Parsed from the 'TB:' line. Each entry may include a count suffix (e.g., 'L Stephens 2')."),

  // Baserunning
  stolenBases: z.number().int().min(0).optional(),
  caughtStealing: z.number().int().min(0).optional(),

  // Fielding
  errors: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("From the 'E:' line under pitching. A bare name counts as 1 error."),
  defensivePlays: z
    .array(z.string())
    .default([])
    .describe(
      "Usually not present in GameChanger PDFs — only fill if the PDF clearly describes notable plays. Otherwise leave empty."
    ),

  // Pitching (optional — only pitchers will have these)
  pitchingInnings: z.number().min(0).optional(),
  pitchingHits: z.number().int().min(0).optional(),
  pitchingRunsAllowed: z.number().int().min(0).optional(),
  earnedRuns: z.number().int().min(0).optional(),
  pitchingWalks: z.number().int().min(0).optional(),
  pitchingStrikeouts: z.number().int().min(0).optional(),
  pitchingHomeRunsAllowed: z.number().int().min(0).optional(),
  pitchesThrown: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("From 'P-S:' line, first number (e.g., 'L Stephens 58-25' → 58)."),
  strikesThrown: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("From 'P-S:' line, second number (e.g., '58-25' → 25)."),
  battersFaced: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("From 'BF:' line."),
});

export const boxScoreSchema = z.object({
  venue: z.enum(["home", "away"]).optional(),
  final: z.object({
    us: z.number().int(),
    them: z.number().int(),
  }),
  innings: z
    .array(
      z.object({
        inning: z.number().int(),
        us: z.number().int(),
        them: z.number().int(),
      })
    )
    .default([]),
  teamHits: z.number().int().optional(),
  teamErrors: z.number().int().optional(),
  players: z.array(playerStatSchema),
  teamNarrative: z
    .string()
    .optional()
    .describe(
      "One-sentence summary of how the game flowed for our team — mention the inning that set the tone. No hype language."
    ),
});

export type BoxScoreExtraction = z.infer<typeof boxScoreSchema>;

export const highlightPickSchema = z.object({
  playerName: z
    .string()
    .describe("Name exactly as it appears in the box score (e.g., 'L Stephens')."),
  jerseyNumber: z
    .number()
    .int()
    .optional()
    .describe("Jersey number — used to reliably match to a roster entry."),
  kind: z.enum([
    "extra_base_hit",
    "rbi",
    "at_bat",
    "pitching",
    "stolen_base",
    "effort",
    "milestone",
    "teamwork",
  ]),
  statLine: z
    .string()
    .describe(
      "Short stat line for overlay, e.g., '1-for-2, 3B, 2 RBI' or '5 IP, 12 K'"
    ),
  headline: z
    .string()
    .max(60)
    .describe(
      "Short, upbeat phrase for the image overlay (6 words max). 8U tone — celebrate effort."
    ),
  caption: z
    .string()
    .max(500)
    .describe(
      "2-3 sentence Instagram caption. Age-appropriate, focuses on effort, learning, teamwork. First-person plural ('we'). Include 1-2 tasteful emojis."
    ),
  overlayText: z
    .string()
    .max(80)
    .describe("Second overlay line for video (jersey + stat line)."),
});

export const highlightPicksSchema = z.object({
  picks: z
    .array(highlightPickSchema)
    .min(1)
    .max(4)
    .describe("Choose 2-4 highlights. Prioritize rotation-boosted players when stats are comparable."),
});

export type HighlightPicks = z.infer<typeof highlightPicksSchema>;
