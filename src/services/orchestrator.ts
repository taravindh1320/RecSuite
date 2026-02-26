/* ─────────────────────────────────────────────────────────
 *  RecSuite — Orchestrator service (Control Cycle)
 *
 *  Receives user input → analyzes intent (IntentAnalyzer) →
 *  fans out to dynamically-resolved mock agents →
 *  synthesizes combined result + structured ReportData.
 *
 *  Emits granular lifecycle callbacks so the UI can reflect
 *  execution state transitions without coupling to internals.
 * ───────────────────────────────────────────────────────── */

import type {
  AgentNode,
  AgentResponse,
  OrchestrationResult,
  ReportData,
  ReportFinding,
} from '@/types/agent';
import type { IntentProfile } from '@/types/intent';
import { analyzeIntent } from '@/services/IntentAnalyzer';
import { AGENT_REGISTRY } from '@/mock/mockAgents';

/* ── Synthesis ───────────────────────────────────────────── */

function synthesizeSummary(responses: AgentResponse[], profile: IntentProfile): string {
  const lines: string[] = [];
  for (const r of responses) {
    if (r.status === 'error') {
      lines.push(`${r.displayName} encountered an error: ${r.summary}`);
      continue;
    }
    lines.push(r.summary);
  }
  const base = lines.join(' ');
  const domainTag = profile.domain !== 'general' ? ` (${profile.domain})` : '';
  return `${base}${domainTag}`.trim() || 'Analysis complete.';
}

function buildReportData(
  responses: AgentResponse[],
  profile: IntentProfile,
  finalSummary: string,
): ReportData {
  const findings: ReportFinding[] = [];

  // Intent & domain
  findings.push({
    label: 'Intent', value: profile.type.replace(/_/g, ' '), status: 'info',
  });
  findings.push({
    label: 'Severity', value: profile.severity, status:
      profile.severity === 'critical' ? 'error' :
      profile.severity === 'high'     ? 'warn'  : 'info',
  });
  if (profile.domain !== 'general') {
    findings.push({ label: 'Domain', value: profile.domain, status: 'info' });
  }

  // Per-agent findings
  for (const r of responses) {
    if (r.status === 'error') {
      findings.push({ label: r.displayName, value: 'Error — agent unavailable', status: 'error' });
      continue;
    }
    if (r.agentId === 'recSignalAgent') {
      const score  = (r.payload.anomalyScore as number) ?? 0;
      const thresh = (r.payload.threshold   as number) ?? 0;
      const det    = r.payload.anomalyDetected as boolean;
      findings.push({
        label: 'Anomaly Score',
        value: `${score} (threshold ${thresh})`,
        status: det ? 'warn' : 'ok',
      });
    }
    if (r.agentId === 'recTraceAgent') {
      const rc   = (r.payload.rootCause as string)?.replace(/_/g, ' ') ?? '—';
      const conf = (r.payload.confidence as number) ?? 0;
      findings.push({
        label: 'Root Cause',
        value: `${rc} — ${Math.round(conf * 100)}% confidence`,
        status: conf >= 0.85 ? 'error' : 'warn',
      });
    }
    if (r.agentId === 'recCheckAgent') {
      const approved    = r.payload.approved as boolean;
      const violations  = (r.payload.violations as number) ?? 0;
      findings.push({
        label: 'Governance',
        value: approved ? 'Passed' : `${violations} violation(s) detected`,
        status: approved ? 'ok' : 'error',
      });
    }
  }

  // Impact scope from trace agent or fallback
  const traceResp  = responses.find((r) => r.agentId === 'recTraceAgent' && r.status === 'success');
  const impactScope: string[] = traceResp
    ? [
        `Service: ${(traceResp.payload.affectedService as string) ?? '—'}`,
        `Traces correlated: ${(traceResp.payload.traceIds as string[])?.length ?? '—'}`,
      ]
    : profile.agentsToInvoke.map((id) => id.replace(/rec|Agent/g, '').toLowerCase() + ' pipeline');

  // Recommended actions
  const actions: string[] = [];
  const hasAnomaly = responses.some(
    (r) => r.agentId === 'recSignalAgent' && r.payload.anomalyDetected,
  );
  const hasCriticalRootCause = responses.some(
    (r) => r.agentId === 'recTraceAgent' && (r.payload.confidence as number) >= 0.85,
  );
  const hasViolation = responses.some(
    (r) => r.agentId === 'recCheckAgent' && !r.payload.approved,
  );
  const hasError = responses.some((r) => r.status === 'error');

  if (hasError)           actions.push('Retry failed agents — upstream service may be recovering.');
  if (hasAnomaly)         actions.push('Investigate anomalous signals — run targeted trace for root cause confirmation.');
  if (hasCriticalRootCause) actions.push('Remediate identified root cause — coordinate with owning service team.');
  if (hasViolation)       actions.push('Resolve governance violations before proceeding — escalate to compliance team.');
  if (actions.length === 0) actions.push('No immediate action required. Continue standard monitoring.');

  return {
    title: `${profile.type.replace(/_/g, ' ')} — Analysis Report`,
    executedAt: Date.now(),
    intentType: profile.type,
    severity: profile.severity,
    domain: profile.domain,
    summary: finalSummary,
    keyFindings: findings,
    impactScope,
    recommendedActions: actions,
  };
}

/* ── Lifecycle callbacks ─────────────────────────────────── */

export interface ControlCycleCallbacks {
  /** Entering planning phase; receives resolved intent profile */
  onPlanning?: (profile: IntentProfile) => void;
  /** A specific agent is about to start */
  onAgentStart?: (displayName: string) => void;
  /** An agent has completed execution */
  onAgentComplete?: (displayName: string, response: AgentResponse, node: AgentNode) => void;
  /** All agents done; synthesizing final output */
  onSynthesis?: (finalMessage: string) => void;
  /** Full cycle complete */
  onComplete?: () => void;
}

/* ── Public API ──────────────────────────────────────────── */

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Runs a single orchestration control cycle.
 *
 * 1. Planning  — analyze intent via IntentAnalyzer
 * 2. Executing — invoke resolved agents sequentially
 * 3. Synthesis — build finalSummary + ReportData
 * 4. Complete  — return OrchestrationResult
 */
export async function runControlCycle(
  userInput: string,
  callbacks?: ControlCycleCallbacks,
): Promise<OrchestrationResult> {
  /* ── 1. Planning ─────────────────────────────────────── */
  const profile: IntentProfile = analyzeIntent(userInput);
  callbacks?.onPlanning?.(profile);
  await delay(600);

  const responses: AgentResponse[] = [];
  const nodes: AgentNode[] = [];

  /* ── 2. Executing ────────────────────────────────────── */
  for (let idx = 0; idx < profile.agentsToInvoke.length; idx++) {
    const agentId = profile.agentsToInvoke[idx];
    const fn = AGENT_REGISTRY[agentId];
    if (!fn) continue;

    const result = await fn(userInput);

    callbacks?.onAgentStart?.(result.displayName);
    await delay(800);

    const node: AgentNode = {
      id: result.agentId,
      label: result.displayName,
      status: result.status,
      order: idx + 1,
    };

    responses.push(result);
    nodes.push(node);
    callbacks?.onAgentComplete?.(result.displayName, result, node);
  }

  nodes.sort((a, b) => a.order - b.order);

  /* ── 3. Synthesis ────────────────────────────────────── */
  const finalSummary = synthesizeSummary(responses, profile);
  const reportData   = buildReportData(responses, profile, finalSummary);
  callbacks?.onSynthesis?.(finalSummary);
  await delay(700);

  /* ── 4. Complete ─────────────────────────────────────── */
  await delay(600);
  callbacks?.onComplete?.();

  return {
    intent: profile.type,
    agents: responses,
    nodes,
    finalSummary,
    reportData,
  };
}
