// Writes routine/schema/draft-brief.schema.json from the Zod DraftBrief schema. `--check` exits 1 when
// the committed file is stale (CI runs it).

import fs from "node:fs";
import path from "node:path";
import { DRAFT_SCHEMA_PATH, renderDraftSchema } from "../lib/json-schema";

function main(): number {
  const rendered = renderDraftSchema();
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(DRAFT_SCHEMA_PATH) ? fs.readFileSync(DRAFT_SCHEMA_PATH, "utf8") : "";
    if (current !== rendered) {
      console.error(`${DRAFT_SCHEMA_PATH} is stale; run npm run schema:gen and commit the result.`);
      return 1;
    }
    console.log(`${DRAFT_SCHEMA_PATH} is current.`);
    return 0;
  }
  fs.mkdirSync(path.dirname(DRAFT_SCHEMA_PATH), { recursive: true });
  fs.writeFileSync(DRAFT_SCHEMA_PATH, rendered);
  console.log(`Wrote ${DRAFT_SCHEMA_PATH} (${rendered.length} bytes).`);
  return 0;
}

process.exitCode = main();
