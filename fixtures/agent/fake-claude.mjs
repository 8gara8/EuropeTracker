#!/usr/bin/env node
// Test stand-in for the Claude CLI (tests/daily.test.ts runs it through ET_CLAUDE_BIN). Prints stream-json
// events shaped like Claude Code 2.1.316's and writes the draft named in the prompt from a prepared file.
// The agent's environment is minimal by design, so settings come from $CLAUDE_CONFIG_DIR/fake-agent.json:
//   mode    "ok" (default) | "nodraft" | "auth"
//   draft   JSON file to write as the draft on a first run
//   repair  JSON file to write on a --resume (repair) run
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const prompt = args[args.indexOf("-p") + 1] ?? "";
const resume = args.includes("--resume") ? args[args.indexOf("--resume") + 1] : null;
const cfgFile = path.join(process.env.CLAUDE_CONFIG_DIR ?? ".", "fake-agent.json");
const cfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, "utf8")) : {};
const mode = cfg.mode ?? "ok";
const emit = (e) => process.stdout.write(`${JSON.stringify(e)}\n`);

emit({ type: "system", subtype: "init", session_id: resume ?? "fake-session-1", model: "fake-model", claude_code_version: "0.0.0-fake", tools: ["WebSearch", "WebFetch", "Read", "Glob", "Grep", "Write", "Edit"] });
if (mode === "auth") {
  emit({ type: "assistant", error: "authentication_failed", message: { content: [{ type: "text", text: "Not logged in · Please run /login" }] } });
  emit({ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login", num_turns: 1, total_cost_usd: 0, permission_denials: [] });
  process.exit(0);
}
const target = prompt.match(/drafts\/\d{4}-\d{2}-\d{2}\.json/)?.[0];
const source = resume ? cfg.repair : cfg.draft;
const text = source ? fs.readFileSync(source, "utf8") : "{}";
const urls = [...new Set(text.match(/https:\/\/[^"\s]+/g) ?? [])];
emit({ type: "assistant", message: { content: [{ type: "tool_use", id: "t1", name: "WebFetch", input: { url: urls[0] ?? "https://example.org", prompt: "read" } }] } });
emit({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: `Fetched. Related links: ${urls.join(" ")}` }] } });
if (mode !== "nodraft" && target) {
  emit({ type: "assistant", message: { content: [{ type: "tool_use", id: "t2", name: "Write", input: { file_path: target } }] } });
  fs.writeFileSync(target, text);
}
emit({ type: "result", subtype: "success", is_error: false, result: "DONE", num_turns: 3, total_cost_usd: 0, permission_denials: [] });
