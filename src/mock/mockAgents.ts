/* ---------------------------------------------------------
 *  RecSuite -- Mock agent definitions (generative simulation)
 *
 *  Agents accept an optional IntentProfile as 2nd arg so
 *  domain-specific use cases (delayed_recon / high_mtp /
 *  server_diagnosis) return structured realistic data drawn
 *  from mockDomainData.  All other calls use the original
 *  randomised pools so no two executions produce identical
 *  results.  Agents still simulate ~10 % error rate.
 * --------------------------------------------------------- */

import type { AgentResponse, ToolCall } from '@/types/agent';
import type { IntentProfile } from '@/types/intent';
import {
  resolveInstance, resolveServer, getDependencies,
  INSTANCES, SERVERS,
} from '@/mock/mockDomainData';

/* == helpers ============================================== */

let _seq = 0;
const uid  = (): string => `tc-${Date.now()}-${++_seq}`;
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rand(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}
function buildTC(
  agentId: string, agentDisplayName: string,
  toolId: string, operationLabel: string,
  input: Record<string, unknown>, output: Record<string, unknown>,
  durationMs: number, status: 'success' | 'error' = 'success',
): ToolCall {
  return { id: uid(), agentId, agentDisplayName, toolId, operationLabel,
           input, output, status, startedAt: Date.now(), durationMs };
}

/* == Randomisation pools ================================== */

const SIGNAL_NAMES       = ['freq_delta','vol_spike','latency_drift','price_deviation',
                            'msg_rate_drop','checksum_mismatch','position_break','feed_timeout',
                            'sequence_gap','book_imbalance'];
const FEATURE_POOLS      = [
  ['freq_delta','vol_spike','latency_drift'],
  ['price_deviation','msg_rate_drop','book_imbalance'],
  ['checksum_mismatch','position_break','feed_timeout'],
  ['sequence_gap','latency_drift','vol_spike'],
  ['freq_delta','checksum_mismatch','price_deviation'],
];
const ANOMALY_THRESHOLDS = [0.65,0.70,0.72,0.75,0.78,0.80];
const ROOT_CAUSES        = [
  'db_connection_pool_exhaustion','cache_invalidation_storm',
  'network_partition_detected','thread_deadlock_in_worker',
  'memory_leak_in_allocator','downstream_service_timeout',
  'kafka_consumer_group_lag','gc_pause_cascade',
  'rate_limit_breach','stale_reference_data',
];
const AFFECTED_SERVICES  = [
  'payment-svc','recon-engine','fx-gateway','settlement-svc',
  'position-mgr','order-router','matching-engine','report-svc',
  'market-data-feed','risk-calculator',
];
const TRACE_POOLS        = [
  { ids: ['trc-8a1f','trc-c203','trc-e7b4'], spans: 12 },
  { ids: ['trc-4d92','trc-f015','trc-a3b8'], spans:  9 },
  { ids: ['trc-bb21','trc-07c6','trc-5e33'], spans: 17 },
  { ids: ['trc-2a8f','trc-d49e'],            spans:  5 },
  { ids: ['trc-9c1b','trc-e7f0','trc-3d44','trc-a61c'], spans: 23 },
];
const POLICY_POOL        = [
  'data-retention-30d','pii-mask','audit-log','sox-segregation',
  'gdpr-article-30','mifid-best-execution','trade-surveillance',
  'risk-limit-check','counterparty-exposure','change-freeze-window',
];

/* == recSignalAgent -> "Monitoring Agent" ================ */

export async function recSignalAgent(
  userInput: string,
  profile?: IntentProfile,
): Promise<AgentResponse> {
  await delay(500 + Math.random() * 600);
  const DISPLAY = 'Monitoring Agent';
  const isError = Math.random() < 0.10;

  if (isError) {
    return {
      agentId: 'recSignalAgent', displayName: DISPLAY, status: 'error',
      toolCalls: [buildTC('recSignalAgent', DISPLAY,
        'extractFeatures', 'Feature Extraction',
        { text: userInput },
        { error: 'Feature extraction failed -- upstream data feed unresponsive' },
        810, 'error',
      )],
      summary: 'Monitoring Agent could not retrieve signal data. Feed timeout.',
      payload: { error: true, reason: 'feed_timeout' },
    };
  }

  /* ---- domain-specific: delayed recon ---- */
  if (profile?.extractedContext?.useCase === 'delayed_recon') {
    const instId = profile.extractedContext.instanceId;
    const inst   = instId ? INSTANCES[instId] : resolveInstance(userInput);
    if (inst) {
      const dur = Math.round(220 + Math.random() * 180);
      const tc  = buildTC('recSignalAgent', DISPLAY,
        'queryDelayedRecons', 'Delayed Recon Query',
        { instance: inst.id, since: 'T-1h' },
        { instance: inst.id, delayedRecons: inst.delayedRecons, count: inst.delayedRecons.length },
        dur,
      );
      return {
        agentId: 'recSignalAgent', displayName: DISPLAY, status: 'success',
        toolCalls: [tc],
        summary: `${inst.delayedRecons.length} delayed recon job(s) found in ${inst.name} instance: ${inst.delayedRecons.join(', ')}.`,
        payload: {
          domain: 'delayed_recon',
          instanceId: inst.id, instanceName: inst.name,
          delayedRecons: inst.delayedRecons,
          count: inst.delayedRecons.length,
        },
      };
    }
  }

  /* ---- domain-specific: high MTP ---- */
  if (profile?.extractedContext?.useCase === 'high_mtp') {
    const instId = profile.extractedContext.instanceId;
    const inst   = instId ? INSTANCES[instId] : resolveInstance(userInput);
    if (inst) {
      const MTP_THRESHOLD = 150;
      const dur = Math.round(180 + Math.random() * 140);
      const tc  = buildTC('recSignalAgent', DISPLAY,
        'queryMTPAccounts', 'MTP Account Scan',
        { instance: inst.id, threshold: MTP_THRESHOLD },
        { instance: inst.id, accounts: inst.highMTPAccounts, threshold: MTP_THRESHOLD },
        dur,
      );
      const breachCount = inst.highMTPAccounts.filter(a => a.mtp > MTP_THRESHOLD).length;
      return {
        agentId: 'recSignalAgent', displayName: DISPLAY, status: 'success',
        toolCalls: [tc],
        summary: `${inst.highMTPAccounts.length} MTP account(s) found in ${inst.name}  ${breachCount} breach threshold of ${MTP_THRESHOLD}.`,
        payload: {
          domain: 'high_mtp',
          instanceId: inst.id, instanceName: inst.name,
          accounts: inst.highMTPAccounts,
          threshold: MTP_THRESHOLD,
        },
      };
    }
  }

  /* ---- generic anomaly detection ---- */
  const features      = pick(FEATURE_POOLS);
  const primarySignal = pick(SIGNAL_NAMES);
  const anomalyScore  = rand(0.52, 0.97);
  const threshold     = pick(ANOMALY_THRESHOLDS);
  const detected      = anomalyScore > threshold;
  const tc1 = buildTC('recSignalAgent', DISPLAY,
    'extractFeatures', 'Feature Extraction',
    { text: userInput },
    { features, count: features.length, samplingWindowMs: pick([500,1000,2000]) },
    Math.round(180 + Math.random() * 120),
  );
  const tc2 = buildTC('recSignalAgent', DISPLAY,
    'scoreAnomaly', 'Anomaly Analysis',
    { features: tc1.output!.features },
    { anomalyScore, threshold, anomalyDetected: detected },
    Math.round(100 + Math.random() * 100),
  );
  return {
    agentId: 'recSignalAgent', displayName: DISPLAY, status: 'success',
    toolCalls: [tc1, tc2],
    summary: detected
      ? `Anomaly detected -- score ${anomalyScore} exceeds threshold (${threshold}). Primary signal: ${primarySignal.replace(/_/g,' ')}.`
      : `No anomaly detected -- score ${anomalyScore} within threshold (${threshold}).`,
    payload: { anomalyScore, threshold, anomalyDetected: detected, primarySignal, features,
               recommendation: detected ? 'Escalate for trace analysis' : 'Continue monitoring' },
  };
}

/* == recTraceAgent -> "Dependency Intelligence Agent" ==== */

export async function recTraceAgent(
  userInput: string,
  profile?: IntentProfile,
): Promise<AgentResponse> {
  await delay(700 + Math.random() * 700);
  const DISPLAY = 'Dependency Intelligence Agent';
  const isError = Math.random() < 0.10;

  if (isError) {
    return {
      agentId: 'recTraceAgent', displayName: DISPLAY, status: 'error',
      toolCalls: [buildTC('recTraceAgent', DISPLAY,
        'correlateSpans', 'Span Correlation',
        { query: userInput },
        { error: 'Trace store returned 503 -- distributed tracing unavailable' },
        1200, 'error',
      )],
      summary: 'Dependency Intelligence could not query trace store. Service degraded.',
      payload: { error: true, reason: 'trace_store_unavailable' },
    };
  }

  /* ---- domain-specific: server_diagnosis -- map to job dep trace ---- */
  if (profile?.extractedContext?.useCase === 'server_diagnosis') {
    const instId = profile.extractedContext.instanceId;
    const inst   = instId ? INSTANCES[instId] : null;
    const allRecons  = inst ? inst.delayedRecons : ['recon.primary', 'recon.secondary'];
    const deps       = getDependencies(allRecons);
    const dur        = Math.round(280 + Math.random() * 200);
    const tc = buildTC('recTraceAgent', DISPLAY,
      'mapJobDependencies', 'Job Dependency Mapping',
      { server: profile.extractedContext.serverId ?? 'unknown', recons: allRecons },
      { upstreamDependencies: deps, reconJobs: allRecons, correlatedSpans: deps.length },
      dur,
    );
    return {
      agentId: 'recTraceAgent', displayName: DISPLAY, status: 'success',
      toolCalls: [tc],
      summary: `Dependency map complete  ${deps.length} upstream jobs identified across ${allRecons.length} recon processes.`,
      payload: { domain: 'server_diagnosis', dependencies: deps, reconJobs: allRecons },
    };
  }

  /* ---- generic trace ---- */
  const rootCause       = pick(ROOT_CAUSES);
  const affectedService = pick(AFFECTED_SERVICES);
  const confidence      = rand(0.67, 0.97);
  const tracePool       = pick(TRACE_POOLS);
  const tc1 = buildTC('recTraceAgent', DISPLAY,
    'correlateSpans', 'Span Correlation',
    { query: userInput },
    { traceIds: tracePool.ids, correlatedSpans: tracePool.spans },
    Math.round(260 + Math.random() * 200),
  );
  const tc2 = buildTC('recTraceAgent', DISPLAY,
    'identifyRoot', 'Root Cause Identification',
    { traceIds: tc1.output!.traceIds },
    { rootCause, confidence, affectedService },
    Math.round(130 + Math.random() * 120),
  );
  return {
    agentId: 'recTraceAgent', displayName: DISPLAY, status: 'success',
    toolCalls: [tc1, tc2],
    summary: `Root cause: ${rootCause.replace(/_/g,' ')} in ${affectedService} (confidence ${Math.round(confidence * 100)}%).`,
    payload: { rootCause, confidence, affectedService, traceIds: tracePool.ids },
  };
}

/* == recCheckAgent -> "Release Validation Agent" ========= */

export async function recCheckAgent(
  userInput: string,
  _profile?: IntentProfile,
): Promise<AgentResponse> {
  await delay(400 + Math.random() * 500);
  const DISPLAY = 'Release Validation Agent';
  const isError = Math.random() < 0.10;

  if (isError) {
    return {
      agentId: 'recCheckAgent', displayName: DISPLAY, status: 'error',
      toolCalls: [buildTC('recCheckAgent', DISPLAY,
        'evaluatePolicy', 'Policy Evaluation',
        { action: userInput },
        { error: 'Policy engine returned timeout -- governance check incomplete' },
        450, 'error',
      )],
      summary: 'Release Validation could not complete -- policy engine unavailable.',
      payload: { error: true, reason: 'policy_engine_timeout' },
    };
  }

  const shuffled         = [...POLICY_POOL].sort(() => Math.random() - 0.5);
  const policies         = shuffled.slice(0, Math.floor(3 + Math.random() * 3));
  const violationCount   = Math.random() < 0.18 ? Math.ceil(Math.random() * 2) : 0;
  const approved         = violationCount === 0;
  const violatingPolicies = violationCount > 0 ? policies.slice(0, violationCount) : [];
  const tc1 = buildTC('recCheckAgent', DISPLAY,
    'evaluatePolicy', 'Policy Evaluation',
    { action: userInput },
    { policies, violations: violationCount, violatingPolicies },
    Math.round(80 + Math.random() * 80),
  );
  const tc2 = buildTC('recCheckAgent', DISPLAY,
    'generateApproval', 'Approval Generation',
    { violations: violationCount },
    { approved, notes: approved
        ? 'All governance checks passed.'
        : `Policy violations detected: ${violatingPolicies.join(', ')}. Escalation required.` },
    Math.round(50 + Math.random() * 60),
  );
  return {
    agentId: 'recCheckAgent', displayName: DISPLAY, status: 'success',
    toolCalls: [tc1, tc2],
    summary: approved
      ? `Governance checks passed -- ${policies.length} policies evaluated, 0 violations.`
      : `Governance check failed -- ${violationCount} violation(s) detected. Escalation recommended.`,
    payload: { approved, violations: violationCount, policies, violatingPolicies },
  };
}

/* == recServerAgent -> "Server Health Agent" ============= */

export async function recServerAgent(
  userInput: string,
  profile?: IntentProfile,
): Promise<AgentResponse> {
  await delay(350 + Math.random() * 400);
  const DISPLAY = 'Server Health Agent';
  const isError = Math.random() < 0.10;

  if (isError) {
    return {
      agentId: 'recServerAgent', displayName: DISPLAY, status: 'error',
      toolCalls: [buildTC('recServerAgent', DISPLAY,
        'collectServerStats', 'Server Stats Collection',
        { query: userInput },
        { error: 'Telemetry endpoint unreachable -- metrics unavailable' },
        320, 'error',
      )],
      summary: 'Server Health Agent could not collect metrics. Telemetry endpoint down.',
      payload: { error: true, reason: 'telemetry_unavailable' },
    };
  }

  const serverId = profile?.extractedContext?.serverId;
  const server   = serverId ? SERVERS[serverId] : resolveServer(userInput);

  if (!server) {
    /* Fallback: synthetic generic stats */
    const cpu = Math.round(30 + Math.random() * 55);
    const mem = Math.round(40 + Math.random() * 45);
    const tc  = buildTC('recServerAgent', DISPLAY,
      'collectServerStats', 'Server Stats Collection',
      { query: userInput },
      { cpu, memory: mem, activeJobs: Math.round(50 + Math.random() * 200), connectionPool: Math.round(20 + Math.random() * 50) },
      Math.round(180 + Math.random() * 120),
    );
    return {
      agentId: 'recServerAgent', displayName: DISPLAY, status: 'success',
      toolCalls: [tc],
      summary: `Server diagnostics collected  CPU ${cpu}%, Memory ${mem}%.`,
      payload: { domain: 'server_diagnosis', cpu, memory: mem,
                 activeJobs: (tc.output as Record<string,unknown>).activeJobs,
                 connectionPool: (tc.output as Record<string,unknown>).connectionPool },
    };
  }

  /* Known server: add small random jitter to simulate live telemetry */
  const jitter = (base: number, spread: number) => Math.min(100, Math.round(base + (Math.random() - 0.5) * spread));
  const cpu            = jitter(server.cpu,            8);
  const memory         = jitter(server.memory,         6);
  const activeJobs     = Math.round(server.activeJobs  + (Math.random() - 0.5) * 30);
  const connectionPool = jitter(server.connectionPool, 5);

  const tc = buildTC('recServerAgent', DISPLAY,
    'collectServerStats', 'Server Stats Collection',
    { server: server.id },
    { serverId: server.id, cpu, memory, activeJobs, connectionPool },
    Math.round(160 + Math.random() * 100),
  );

  const warnings: string[] = [];
  if (cpu            > 75) warnings.push(`CPU critical (${cpu}%)`);
  if (memory         > 80) warnings.push(`Memory pressure (${memory}%)`);
  if (connectionPool > 85) warnings.push(`Connection pool near exhaustion (${connectionPool}%)`);

  return {
    agentId: 'recServerAgent', displayName: DISPLAY, status: 'success',
    toolCalls: [tc],
    summary: warnings.length > 0
      ? `Server ${server.id}: ${warnings.join('; ')}. ${activeJobs} active jobs.`
      : `Server ${server.id} operating nominally  CPU ${cpu}%, Memory ${memory}%, ${activeJobs} active jobs.`,
    payload: {
      domain: 'server_diagnosis',
      serverId: server.id,
      cpu, memory, activeJobs, connectionPool,
      warnings,
    },
  };
}

/* == Agent registry ======================================= */

export const AGENT_REGISTRY: Record<
  string,
  (input: string, profile?: IntentProfile) => Promise<AgentResponse>
> = {
  recSignalAgent,
  recTraceAgent,
  recCheckAgent,
  recServerAgent,
};
