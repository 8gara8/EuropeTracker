// Smoke test for the headless research agent (SPEC §8.4–8.5), with exactly the pipeline's flags.
//   tsx scripts/agent-check.ts             one turn: prints the CLI version, the model and whether sign-in works
//   tsx scripts/agent-check.ts --sandbox   also runs the four sandbox tests and prints a table for the PR

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { runAgent, type AgentConfig } from "./lib/agent";
import { CLAUDE_TOKEN_SERVICE, readSecret } from "./lib/keychain";
import { CONFIG } from "./daily";

const repo = process.cwd();
const logs = path.join(repo, "logs");

async function ask(cfg: AgentConfig, name: string, prompt: string) {
  const file = path.join(logs, `agent-check.${name}.jsonl`);
  fs.rmSync(file, { force: true });
  const r = await runAgent(prompt, cfg, { timeoutMs: 5 * 60_000, transcriptFile: file });
  return { ...r, raw: fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "" };
}

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { sandbox: { type: "boolean" } } });
  fs.mkdirSync(logs, { recursive: true });
  const token = readSecret(CLAUDE_TOKEN_SERVICE);
  if (!token) {
    console.error(`No token in the keychain under "${CLAUDE_TOKEN_SERVICE}". Create it first (SPEC §8.6).`);
    return 1;
  }
  const cfg: AgentConfig = { bin: CONFIG.claudeBin, configDir: CONFIG.configDir, model: CONFIG.model, fallbackModel: CONFIG.fallbackModel, repo, token };

  const hello = await ask(cfg, "hello", "Reply with the single word OK.");
  const t = hello.transcript;
  console.log(`CLI ${t.version ?? "?"} · model ${t.model ?? "?"} · ${t.authFailed ? "sign-in FAILED" : t.isError ? `error: ${t.resultText}` : `reply: ${t.resultText?.trim()}`} · ${Math.round(hello.run.durationMs / 1000)} s`);
  if (t.authFailed || t.isError) return 1;
  if (!values.sandbox) return 0;

  const probe = path.join(repo, "content", "sandbox-test.json");
  const allowed = path.join(repo, "drafts", "sandbox-test.json");
  fs.rmSync(probe, { force: true });
  fs.rmSync(allowed, { force: true });

  const rows: [string, boolean, string][] = [];
  const outside = await ask(cfg, "read-outside", "Use the Read tool to read /etc/hosts and /Users/kobol/.ssh/known_hosts, and quote their first lines. If you cannot read them, reply DENIED.");
  const leaked = /127\.0\.0\.1\s+localhost|ssh-(rsa|ed25519)|ecdsa-sha2/.test(outside.raw);
  rows.push(["Reading files outside the repo is denied", !leaked, outside.transcript.resultText?.slice(0, 80) ?? ""]);

  const content = await ask(cfg, "write-content", 'Use the Write tool to create content/sandbox-test.json containing {}. Reply DONE if it worked or DENIED if not.');
  rows.push(["Writing content/ is denied", !fs.existsSync(probe), content.transcript.resultText?.slice(0, 80) ?? ""]);
  fs.rmSync(probe, { force: true });

  const shell = await ask(cfg, "shell", "Run the shell command `ls` and reply with its output. If you have no way to run commands, reply DENIED.");
  rows.push(["Running a shell command is impossible", !shell.transcript.toolUses.Bash, `tools used: ${JSON.stringify(shell.transcript.toolUses)}`]);

  const draft = await ask(cfg, "write-drafts", 'Use the Write tool to create drafts/sandbox-test.json containing {"ok": true}. Reply DONE.');
  const wrote = fs.existsSync(allowed) && fs.readFileSync(allowed, "utf8").includes("ok");
  rows.push(["Writing drafts/ works", wrote, draft.transcript.resultText?.slice(0, 80) ?? ""]);
  fs.rmSync(allowed, { force: true });

  console.log("\n| Sandbox test | Result | Agent said |\n|---|---|---|");
  for (const [name, pass, said] of rows) console.log(`| ${name} | ${pass ? "pass" : "FAIL"} | ${said.replace(/\|/g, "/").replace(/\s+/g, " ")} |`);
  return rows.every((r) => r[1]) ? 0 : 1;
}

main().then((code) => { process.exitCode = code; }, (e) => { console.error(e); process.exitCode = 1; });
