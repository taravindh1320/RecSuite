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
  DomainSection,
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

function buildDomainSection(
  responses: AgentResponse[],
  profile: IntentProfile,
): DomainSection | null {
  const useCase = profile.extractedContext?.useCase;

  if (useCase === 'delayed_recon') {
    const r = responses.find((x) => x.agentId === 'recSignalAgent' && x.status === 'success');
    if (r && r.payload.domain === 'delayed_recon') {
      return {
        type: 'delayed_recon',
        instanceId:   r.payload.instanceId   as string,
        instanceName: r.payload.instanceName as string,
        recons:       r.payload.delayedRecons as string[],
      };
    }
  }

  if (useCase === 'high_mtp') {
    const r = responses.find((x) => x.agentId === 'recSignalAgent' && x.status === 'success');
    if (r && r.payload.domain === 'high_mtp') {
      return {
        type:         'high_mtp',
        instanceId:   r.payload.instanceId   as string,
        instanceName: r.payload.instanceName as string,
        accounts:     r.payload.accounts     as { name: string; mtp: number }[],
        threshold:    r.payload.threshold    as number,
      };
    }
  }

  if (useCase === 'server_diagnosis') {
    const srv   = responses.find((x) => x.agentId === 'recServerAgent'  && x.status === 'success');
    const trace = responses.find((x) => x.agentId === 'recTraceAgent'   && x.status === 'success');
    if (srv && srv.payload.domain === 'server_diagnosis') {
      const deps =
        (trace?.payload.domain === 'server_diagnosis'
          ? (trace.payload.dependencies as string[])
          : []) ?? [];
      return {
        type:           'server_diagnosis',
        serverId:       srv.payload.serverId       as string,
        cpu:            srv.payload.cpu            as number,
        memory:         srv.payload.memory         as number,
        activeJobs:     srv.payload.activeJobs     as number,
        connectionPool: srv.payload.connectionPool as number,
        dependencies:   deps,
      };
    }
  }

  return null;
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
    if (r.agentId === 'recServerAgent') {
      const cpu  = (r.payload.cpu  as number) ?? 0;
      const mem  = (r.payload.memory as number) ?? 0;
      const pool = (r.payload.connectionPool as number) ?? 0;
      const status = (cpu > 75 || mem > 80 || pool > 85) ? 'warn' : 'ok';
      findings.push({
        label: 'Server Health',
        value: `CPU ${cpu}% | Mem ${mem}% | Pool ${pool}%`,
        status,
      });
    }
  }

  // Impact scope from trace agent or fallback
  const traceResp  = responses.find((r) => r.agentId === 'recTraceAgent' && r.status === 'success');
  const serverResp = responses.find((r) => r.agentId === 'recServerAgent' && r.status === 'success');
  const impactScope: string[] = traceResp
    ? [
        `Service: ${(traceResp.payload.affectedService as string) ?? '—'}`,
        `Traces correlated: ${(traceResp.payload.traceIds as string[])?.length ?? '—'}`,
      ]
    : serverResp
    ? [
        `Server: ${(serverResp.payload.serverId as string) ?? '—'}`,
        `Active jobs: ${serverResp.payload.activeJobs}`,
      ]
    : profile.agentsToInvoke.map((id) => id.replace(/rec|Agent/g, '').toLowerCase() + ' pipeline');

  // Domain section (structured data for rich ReportPanel rendering)
  const domainSection = buildDomainSection(responses, profile);

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

  if (hasError)             actions.push('Retry failed agents — upstream service may be recovering.');
  if (hasAnomaly)           actions.push('Investigate anomalous signals — run targeted trace for root cause confirmation.');
  if (hasCriticalRootCause) actions.push('Remediate identified root cause — coordinate with owning service team.');
  if (hasViolation)         actions.push('Resolve governance violations before proceeding — escalate to compliance team.');
  // Domain-specific actions
  const signalResp = responses.find(r => r.agentId === 'recSignalAgent' && r.status === 'success');
  if (signalResp?.payload.domain === 'delayed_recon') {
    actions.push('Investigate delayed recon jobs — check upstream job completion and data feed latency.');
  }
  if (signalResp?.payload.domain === 'high_mtp') {
    const breachedNames = ((signalResp.payload.accounts ?? []) as { name: string; mtp: number }[])
      .filter(a => a.mtp > 180).map(a => a.name);
    if (breachedNames.length > 0) {
      actions.push(`Escalate high-MTP accounts for review: ${breachedNames.join(', ')}.`);
    }
  }
  if (serverResp?.payload.domain === 'server_diagnosis') {
    const warns = (serverResp.payload.warnings as string[]) ?? [];
    if (warns.length > 0) actions.push(`Server resource alerts require attention: ${warns.join('; ')}.`);
    actions.push('Review upstream job dependencies — consider re-scheduling delayed jobs.');
  }
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
    domainSection: domainSection ?? undefined,
  };
}

/* ── Lifecycle callbacks ─────────────────────────────────── */

export interface ControlCycleCallbacks {
  /** Entering planning phase; receives resolved intent profile */
  onPlanning?: (profile: IntentProfile) => void;
  /** A specific agent is about to start */
  onAgentStart?: (displayName: string, agentId: string) => void;
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

    const result = await fn(userInput, profile);

    callbacks?.onAgentStart?.(result.displayName, result.agentId);
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
