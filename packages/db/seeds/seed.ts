import { repository, PostgresRepository } from "../src/index";
import { demoSeed } from "../src/seed-data";
import { secret } from "../../config/src/index";
import { addDemoEvidence } from "../src/demo-evidence";
const repo = repository();
await repo.transaction(async (tx) => {
  if (tx.state.reports.length) {
    console.info("Existing dataset preserved.");
    return;
  }
  Object.assign(tx.state, demoSeed(secret("AUDIT_HASH_SECRET")));
  await addDemoEvidence(tx.state);
  console.info("Seeded 21 synthetic DEMO reports and demo profiles.");
});
if (repo instanceof PostgresRepository) await repo.pool.end();
