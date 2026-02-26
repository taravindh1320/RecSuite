/* ─────────────────────────────────────────────────────────
 *  RecSuite — Core domain types
 * ───────────────────────────────────────────────────────── */

/** Possible execution states for an agent or tool call */
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'error';

/** A single tool invocation performed by an agent */
export interface ToolCall {
  id: string;
  /** Internal agent identifier (never shown to the user) */
  agentId: string;
  /** User‑facing agent label */
  agentDisplayName: string;
  /** Internal tool/function name (never shown to the user) */
  toolId: string;
  /** User‑facing operation label */
  operationLabel: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: ExecutionStatus;
  /** Unix‑ms timestamp when the call started */
  startedAt: number;
  /** Duration in ms (populated after completion) */
  durationMs: number | null;
}

/** Structured response returned by every mock agent */
export interface AgentResponse {
  /** Internal identifier (never shown to the user) */
  agentId: string;
  /** User‑facing display name */
  displayName: string;
  status: ExecutionStatus;
  toolCalls: ToolCall[];
  summary: string;
  /** Raw payload the agent "computed" */
  payload: Record<string, unknown>;
}

/** A single chat message in the conversation */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/** Node in the agent task graph (for visualization) */
export interface AgentNode {
  id: string;
  label: string;
  status: ExecutionStatus;
  /** Ordered position in the execution pipeline */
  order: number;
}

/** Combined orchestration result returned to the UI */
export interface OrchestrationResult {
  intent: string;
  agents: AgentResponse[];
  nodes: AgentNode[];
  finalSummary: string;
  reportData: ReportData;
}

/* ─── Report panel types ───────────────────────────────── */

export type FindingStatus = 'ok' | 'warn' | 'error' | 'info';

export interface ReportFinding {
  label: string;
  value: string;
  status: FindingStatus;
}

export interface ReportData {
  title: string;
  executedAt: number;
  intentType: string;
  severity: string;
  domain: string;
  summary: string;
  keyFindings: ReportFinding[];
  impactScope: string[];
  recommendedActions: string[];
}
