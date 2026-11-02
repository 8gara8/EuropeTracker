import { extractUrls, normalizeUrl } from "../../lib/urls";

// Reads the agent's stream-json transcript (SPEC §7.10). Event shapes checked against Claude Code
// 2.1.316 on 2026-11-02: a {type:"system",subtype:"init"} event carries session_id, model and
// claude_code_version; tool calls are tool_use blocks inside {type:"assistant"} messages; tool output is
// tool_result blocks inside {type:"user"} messages; the run ends with a {type:"result"} event whose
// is_error flag (not the exit code, and not its subtype) says whether the run failed.

export interface Transcript {
  sessionId: string | null;
  model: string | null;
  version: string | null;
  /** URLs the agent opened with WebFetch. */
  fetched: string[];
  /** Every URL that appeared in a tool result: search results and fetched pages. */
  resultUrls: string[];
  searches: string[];
  toolUses: Record<string, number>;
  isError: boolean | null;
  resultText: string | null;
  numTurns: number | null;
  costUsd: number | null;
  permissionDenials: number;
  authFailed: boolean;
}

type Block = { type?: string; name?: string; input?: Record<string, unknown>; content?: unknown };

export function parseTranscript(jsonl: string): Transcript {
  const t: Transcript = {
    sessionId: null, model: null, version: null, fetched: [], resultUrls: [], searches: [], toolUses: {},
    isError: null, resultText: null, numTurns: null, costUsd: null, permissionDenials: 0, authFailed: false,
  };
  for (const line of jsonl.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    let e: Record<string, unknown>;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.type === "system" && e.subtype === "init") {
      t.sessionId ??= (e.session_id as string) ?? null;
      t.model ??= (e.model as string) ?? null;
      t.version ??= (e.claude_code_version as string) ?? null;
    }
    if (e.error === "authentication_failed") t.authFailed = true;
    const content = (e.message as { content?: unknown } | undefined)?.content;
    if (Array.isArray(content)) {
      for (const block of content as Block[]) {
        if (block.type === "tool_use" && block.name) {
          t.toolUses[block.name] = (t.toolUses[block.name] ?? 0) + 1;
          if (block.name === "WebFetch" && typeof block.input?.url === "string") t.fetched.push(block.input.url);
          if (block.name === "WebSearch" && typeof block.input?.query === "string") t.searches.push(block.input.query);
        }
        if (block.type === "tool_result") {
          const text = typeof block.content === "string" ? block.content : JSON.stringify(block.content ?? "");
          t.resultUrls.push(...extractUrls(text));
        }
      }
    }
    if (e.type === "result") {
      t.sessionId ??= (e.session_id as string) ?? null;
      t.isError = e.is_error === true;
      t.resultText = typeof e.result === "string" ? e.result : null;
      t.numTurns = typeof e.num_turns === "number" ? e.num_turns : null;
      t.costUsd = typeof e.total_cost_usd === "number" ? e.total_cost_usd : null;
      t.permissionDenials = Array.isArray(e.permission_denials) ? e.permission_denials.length : 0;
    }
  }
  return t;
}

/** Evidence set (SPEC §7.10): pack URLs ∪ fetched URLs ∪ URLs in tool results, normalized and unique. */
export function evidenceUrls(transcripts: Transcript[], packUrls: string[]): string[] {
  const all = [...packUrls, ...transcripts.flatMap((t) => [...t.fetched, ...t.resultUrls])];
  return [...new Set(all.map(normalizeUrl))].sort();
}
