import type { Player } from "./db/schema";

/**
 * Rotation boost: how much "priority" a player should get when the highlight
 * selector picks among comparable performances. A player with 0 spotlights
 * so far this season gets the highest boost; the most-featured player gets 0.
 */
export function computeRotationBoost(
  roster: Player[]
): Record<string, number> {
  if (roster.length === 0) return {};
  const max = Math.max(...roster.map((p) => p.spotlightCount));
  const out: Record<string, number> = {};
  for (const p of roster) {
    out[p.id] = max - p.spotlightCount;
  }
  return out;
}

/**
 * Returns players who have been featured fewer than the season median —
 * the LLM should prefer these when stats are comparable.
 */
export function underFeaturedPlayers(roster: Player[]): Player[] {
  if (roster.length === 0) return [];
  const counts = roster.map((p) => p.spotlightCount).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)];
  return roster.filter((p) => p.spotlightCount < median);
}
