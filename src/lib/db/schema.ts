import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const postStatus = pgEnum("post_status", [
  "draft",
  "approved",
  "scheduled",
  "published",
  "failed",
]);

export const postKind = pgEnum("post_kind", [
  "spotlight",
  "recap",
  "milestone",
]);

export const renderStatus = pgEnum("render_status", [
  "pending",
  "rendering",
  "ready",
  "failed",
]);

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ageGroup: text("age_group").notNull().default("8U"),
  season: text("season").notNull(),
  brand: jsonb("brand").$type<{
    primary: string;
    secondary: string;
    logoUrl?: string;
    font?: string;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  jerseyNumber: integer("jersey_number"),
  primaryPosition: text("primary_position"),
  photoUrl: text("photo_url"),
  consentOk: boolean("consent_ok").notNull().default(true),
  spotlightCount: integer("spotlight_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  opponent: text("opponent").notNull(),
  teamScore: integer("team_score"),
  opponentScore: integer("opponent_score"),
  boxScorePdfUrl: text("box_score_pdf_url"),
  clipUrls: jsonb("clip_urls").$type<string[]>().notNull().default([]),
  photoUrls: jsonb("photo_urls").$type<string[]>().notNull().default([]),
  extractedStats: jsonb("extracted_stats").$type<ExtractedGameStats | null>(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const highlightStatus = pgEnum("highlight_status", [
  "proposed",
  "selected",
  "rejected",
]);

export const highlights = pgTable("highlights", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").references(() => players.id, {
    onDelete: "set null",
  }),
  status: highlightStatus("status").notNull().default("proposed"),
  kind: text("kind").notNull(),
  statLine: text("stat_line"),
  headline: text("headline").notNull(),
  caption: text("caption").notNull(),
  overlayText: text("overlay_text").notNull(),
  playerNameRaw: text("player_name_raw"),
  jerseyNumber: integer("jersey_number"),
  sourceMediaUrl: text("source_media_url"),
  photoUrl: text("photo_url"),
  backgroundUrl: text("background_url"),
  generatedImageUrl: text("generated_image_url"),
  imagePrompt: text("image_prompt"),
  rotationBoost: integer("rotation_boost").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  highlightId: uuid("highlight_id").references(() => highlights.id, {
    onDelete: "cascade",
  }),
  kind: postKind("kind").notNull().default("spotlight"),
  status: postStatus("status").notNull().default("draft"),
  renderStatus: renderStatus("render_status").notNull().default("pending"),
  caption: text("caption").notNull(),
  outputVideoUrl: text("output_video_url"),
  outputImageUrl: text("output_image_url"),
  shotstackRenderId: text("shotstack_render_id"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  bufferUpdateId: text("buffer_update_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  players: many(players),
  games: many(games),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  team: one(teams, { fields: [players.teamId], references: [teams.id] }),
  highlights: many(highlights),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  team: one(teams, { fields: [games.teamId], references: [teams.id] }),
  highlights: many(highlights),
  posts: many(posts),
}));

export const highlightsRelations = relations(highlights, ({ one, many }) => ({
  game: one(games, { fields: [highlights.gameId], references: [games.id] }),
  player: one(players, {
    fields: [highlights.playerId],
    references: [players.id],
  }),
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  game: one(games, { fields: [posts.gameId], references: [games.id] }),
  highlight: one(highlights, {
    fields: [posts.highlightId],
    references: [highlights.id],
  }),
}));

export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Highlight = typeof highlights.$inferSelect;
export type Post = typeof posts.$inferSelect;

export type ExtractedPlayerStats = {
  playerName: string;
  jerseyNumber?: number;
  position?: string;
  atBats?: number;
  hits?: number;
  runs?: number;
  rbi?: number;
  walks?: number;
  strikeouts?: number;
  doubles?: number;
  triples?: number;
  homeRuns?: number;
  totalBases?: number;
  stolenBases?: number;
  caughtStealing?: number;
  errors?: number;
  defensivePlays?: string[];
  pitchingInnings?: number;
  pitchingHits?: number;
  pitchingRunsAllowed?: number;
  earnedRuns?: number;
  pitchingWalks?: number;
  pitchingStrikeouts?: number;
  pitchingHomeRunsAllowed?: number;
  pitchesThrown?: number;
  strikesThrown?: number;
  battersFaced?: number;
};

export type ExtractedGameStats = {
  venue?: "home" | "away";
  final: { us: number; them: number };
  innings?: Array<{ inning: number; us: number; them: number }>;
  teamHits?: number;
  teamErrors?: number;
  players: ExtractedPlayerStats[];
  teamNarrative?: string;
};
