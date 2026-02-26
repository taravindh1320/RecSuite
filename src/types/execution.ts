/* ─────────────────────────────────────────────────────────
 *  RecSuite — Centralized execution lifecycle state
 * ───────────────────────────────────────────────────────── */

/**
 * Represents the current phase of the orchestration control cycle.
 *
 * idle          → No active processing; system at rest
 * planning      → Intent detected; resolving which agents to invoke
 * executing     → One or more agents actively running
 * synthesizing  → All agents complete; composing final response
 * complete      → Cycle finished successfully
 * error         → Cycle terminated due to failure
 */
export type ExecutionState =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'synthesizing'
  | 'complete'
  | 'error';
