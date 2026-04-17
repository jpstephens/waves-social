import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db, games, highlights, posts, players } from "../src/lib/db/index";

async function main() {
  const deletedPosts = await db.delete(posts).returning({ id: posts.id });
  const deletedHighlights = await db
    .delete(highlights)
    .returning({ id: highlights.id });
  const deletedGames = await db.delete(games).returning({ id: games.id });
  const reset = await db
    .update(players)
    .set({ spotlightCount: 0 })
    .returning({ id: players.id });
  console.log(
    `Deleted ${deletedGames.length} games, ${deletedHighlights.length} highlights, ${deletedPosts.length} posts. Reset ${reset.length} player spotlight counts.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
