import fs from "node:fs";
import { run, type RunResult } from "./run";
import { parseTranscript, type Transcript } from "./transcript";

// The headless research agent (SPEC §8.4, §8.5). Flags checked against Claude Code 2.1.316:
//   --restricted     removes the tools that run commands or code, confines the file tools to the
//                    working directory and ignores user, project and local settings files
//   --safe-mode      no CLAUDE.md, skills, plugins, hooks, custom agents or MCP servers
//   --tools          the only built-in tools that exist for the session
//   --permission-mode dontAsk with --permission-prompts none: anything not allowed is denied, never asked
// This version has no --max-turns; the timeout bounds the run. --bare is avoided because it refuses OAuth.

export const AGENT_TOOLS = ["WebSearch", "WebFetch", "Read", "Glob", "Grep", "Write", "Edit"];
export const AGENT_SETTINGS = "routine/agent-settings.json";

export interface AgentConfig {
  bin: string;
  configDir: string;
  model: string;
  fallbackModel: string | null;
  repo: string;
  token: string;
}

export function agentArgs(prompt: string, cfg: Pick<AgentConfig, "model" | "fallbackModel">, resume?: string): string[] {
  return [
    "-p", prompt,
    ...(resume ? ["--resume", resume] : []),
    "--model", cfg.model,
    ...(cfg.fallbackModel ? ["--fallback-model", cfg.fallbackModel] : []),
    "--output-format", "stream-json",
    "--verbose",
    "--restricted",
    "--safe-mode",
    "--tools", AGENT_TOOLS.join(","),
    "--settings", AGENT_SETTINGS,
    "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
    "--permission-mode", "dontAsk",
    "--permission-prompts", "none",
    "--allowedTools", "WebSearch", "WebFetch", "Read", "Glob", "Grep", "Write(drafts/**)", "Edit(drafts/**)",
    "--disallowedTools", "Bash", "Task", "NotebookEdit",
  ];
}

/** A minimal environment: nothing from JL's shell reaches the agent except what it needs. */
export function agentEnv(cfg: Pick<AgentConfig, "configDir" | "token">): Record<string, string> {
  return {
    HOME: process.env.HOME ?? "/Users/kobol",
    PATH: "/opt/homebrew/bin:/usr/bin:/bin",
    TZ: "Asia/Taipei",
    LANG: "en_US.UTF-8",
    CLAUDE_CONFIG_DIR: cfg.configDir,
    CLAUDE_CODE_OAUTH_TOKEN: cfg.token,
    DISABLE_AUTOUPDATER: "1",
  };
}

export async function runAgent(prompt: string, cfg: AgentConfig, opts: { timeoutMs: number; transcriptFile: string; resume?: string }): Promise<{ run: RunResult; transcript: Transcript }> {
  fs.rmSync(opts.transcriptFile, { force: true });
  fs.rmSync(`${opts.transcriptFile}.stderr`, { force: true });
  const r = await run(cfg.bin, agentArgs(prompt, cfg, opts.resume), {
    cwd: cfg.repo,
    env: agentEnv(cfg),
    timeoutMs: opts.timeoutMs,
    stdoutFile: opts.transcriptFile,
    stderrFile: `${opts.transcriptFile}.stderr`,
  });
  const text = fs.existsSync(opts.transcriptFile) ? fs.readFileSync(opts.transcriptFile, "utf8") : "";
  return { run: r, transcript: parseTranscript(text) };
}

/** Fills {{NAME}} placeholders (SPEC §10) and refuses to leave any unfilled. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  const out = template.replace(/\{\{([A-Z_]+)\}\}/g, (m, name: string) => (name in vars ? vars[name]! : m));
  const left = out.match(/\{\{[A-Z_]+\}\}/g);
  if (left) throw new Error(`Unfilled template variables: ${[...new Set(left)].join(", ")}`);
  return out;
}
