// Applies the schema and seed to DATABASE_URL (e.g. Supabase). The app also does this automatically on first request.
// Run: DATABASE_URL=... npx tsx scripts/setup-db.ts
import { ensureReady, q } from "../lib/db";
(async () => {
  await ensureReady();
  const r = await q<{ n: number }>("select count(*)::int as n from item_aspect_scores");
  console.log(`Ready. ${r[0].n} item × lens aspect scores loaded.`);
  process.exit(0);
})();
