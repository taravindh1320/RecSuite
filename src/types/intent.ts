/* ─────────────────────────────────────────────────────────
 *  Intent types — used by IntentAnalyzer and orchestrator
 * ───────────────────────────────────────────────────────── */

export type IntentType =
  | 'anomaly_detection'
  | 'root_cause_trace'
  | 'compliance_check'
  | 'performance_analysis'
  | 'incident_response'
  | 'full_analysis';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type AgentId = 'recSignalAgent' | 'recTraceAgent' | 'recCheckAgent';

export interface IntentProfile {
  type: IntentType;
  severity: SeverityLevel;
  /** Ordered list of agent IDs to invoke for this intent */
  agentsToInvoke: AgentId[];
  /** Keywords extracted from user input that drove classification */
  primaryKeywords: string[];
  /** Business domain inferred from user input */
  domain: string;
}
