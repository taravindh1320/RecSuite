/* ─────────────────────────────────────────────────────────
 *  Intent types — used by IntentAnalyzer and orchestrator
 * ───────────────────────────────────────────────────────── */

export type IntentType =
  | 'anomaly_detection'
  | 'root_cause_trace'
  | 'compliance_check'
  | 'performance_analysis'
  | 'incident_response'
  | 'full_analysis'
  | 'delayed_recon_query'
  | 'high_mtp_query'
  | 'server_diagnosis';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type AgentId =
  | 'recSignalAgent'
  | 'recTraceAgent'
  | 'recCheckAgent'
  | 'recServerAgent';

/** Structured context extracted alongside the intent classification */
export interface ExtractedContext {
  /** Dominant use-case within the intent */
  useCase?: 'delayed_recon' | 'high_mtp' | 'server_diagnosis';
  /** Resolved recon instance identifier (INV / SNPB / FX / ICG) */
  instanceId?: string;
  /** Resolved server identifier (e.g. ICGRECON6P) */
  serverId?: string;
}

export interface IntentProfile {
  type: IntentType;
  severity: SeverityLevel;
  /** Ordered list of agent IDs to invoke for this intent */
  agentsToInvoke: AgentId[];
  /** Keywords extracted from user input that drove classification */
  primaryKeywords: string[];
  /** Business domain inferred from user input */
  domain: string;
  /** Domain-specific context extracted from free text */
  extractedContext?: ExtractedContext;
}
