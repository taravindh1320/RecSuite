/* ─────────────────────────────────────────────────────────
 *  RecSuite — Mock agent definitions (generative simulation)
 *
 *  Each call draws from randomization pools so no two
 *  executions produce identical results. Agents occasionally
 *  simulate error cases (~10% each).
 *
 *  Internal identifiers are never surfaced to the UI —
 *  only displayName / operationLabel are shown.
 * ───────────────────────────────────────────────────────── */

import type { AgentResponse, ToolCall } from '@/types/agent';

/* ── helpers ─────────────────────────────────────────────── */

let _seq = 0;
const uid = (): string => `tc-${Date.now()}-${++_seq}`;
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Pick a random element from an array */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Random float between min and max, rounded to 2dp */
function rand(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function buildToolCall(
  agentId: string,
  agentDisplayName: string,
  toolId: string,
  operationLabel: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  durationMs: number,
  status: 'success' | 'error' = 'success',
): ToolCall {
  return {
    id: uid(),
    agentId,
    agentDisplayName,
    toolId,
    operationLabel,
    input,
    output,
    status,
    startedAt: Date.now(),
    durationMs,
  };
}

/* ── Randomization pools ─────────────────────────────────── */

const SIGNAL_NAMES = [
  'freq_delta', 'vol_spike', 'latency_drift', 'price_deviation',
  'msg_rate_drop', 'checksum_mismatch', 'position_break', 'feed_timeout',
  'sequence_gap', 'book_imbalance',
];

const FEATURE_POOLS = [
  ['freq_delta', 'vol_spike', 'latency_drift'],
  ['price_deviation', 'msg_rate_drop', 'book_imbalance'],
  ['checksum_mismatch', 'position_break', 'feed_timeout'],
  ['sequence_gap', 'latency_drift', 'vol_spike'],
  ['freq_delta', 'checksum_mismatch', 'price_deviation'],
];

const ANOMALY_THRESHOLDS = [0.65, 0.70, 0.72, 0.75, 0.78, 0.80];

const ROOT_CAUSES = [
  'db_connection_pool_exhaustion',
  'cache_invalidation_storm',
  'network_partition_detected',
  'thread_deadlock_in_worker',
  'memory_leak_in_allocator',
  'downstream_service_timeout',
  'kafka_consumer_group_lag',
  'gc_pause_cascade',
  'rate_limit_breach',
  'stale_reference_data',
];

const AFFECTED_SERVICES = [
  'payment-svc', 'recon-engine', 'fx-gateway', 'settlement-svc',
  'position-mgr', 'order-router', 'matching-engine', 'report-svc',
  'market-data-feed', 'risk-calculator',
];

const TRACE_POOLS: Array<{ ids: string[]; spans: number }> = [
  { ids: ['trc-8a1f', 'trc-c203', 'trc-e7b4'], spans: 12 },
  { ids: ['trc-4d92', 'trc-f015', 'trc-a3b8'], spans: 9  },
  { ids: ['trc-bb21', 'trc-07c6', 'trc-5e33'], spans: 17 },
  { ids: ['trc-2a8f', 'trc-d49e'],              spans: 5  },
  { ids: ['trc-9c1b', 'trc-e7f0', 'trc-3d44', 'trc-a61c'], spans: 23 },
];

const POLICY_POOL = [
  'data-retention-30d', 'pii-mask', 'audit-log',
  'sox-segregation', 'gdpr-article-30', 'mifid-best-execution',
  'trade-surveillance', 'risk-limit-check', 'counterparty-exposure',
  'change-freeze-window',
];

/* ── recSignalAgent → "Monitoring Agent" ─────────────────── */

export async function recSignalAgent(userInput: string): Promise<AgentResponse> {
  await delay(500 + Math.random() * 600);

  const DISPLAY = 'Monitoring Agent';
  const isError = Math.random() < 0.10;

  if (isError) {
    const tc = buildToolCall(
      'recSignalAgent', DISPLAY,
      'extractFeatures', 'Feature Extraction',
      { text: userInput },
      { error: 'Feature extraction failed — upstream data feed unresponsive' },
      810, 'error',
    );
    return {
      agentId:     'recSignalAgent',
      displayName: DISPLAY,
      status:      'error',
      toolCalls:   [tc],
      summary:     'Monitoring Agent could not retrieve signal data. Feed timeout.',
      payload:     { error: true, reason: 'feed_timeout' },
    };
  }

  const features       = pick(FEATURE_POOLS);
  const primarySignal  = pick(SIGNAL_NAMES);
  const anomalyScore   = rand(0.52, 0.97);
  const threshold      = pick(ANOMALY_THRESHOLDS);
  const detected       = anomalyScore > threshold;
  const dur1           = Math.round(180 + Math.random() * 120);
  const dur2           = Math.round(100 + Math.random() * 100);

  const tc1 = buildToolCall(
    'recSignalAgent', DISPLAY,
    'extractFeatures', 'Feature Extraction',
    { text: userInput },
    { features, count: features.length, samplingWindowMs: pick([500, 1000, 2000]) },
    dur1,
  );

  const tc2 = buildToolCall(
    'recSignalAgent', DISPLAY,
    'scoreAnomaly', 'Anomaly Analysis',
    { features: tc1.output!.features },
    { anomalyScore, threshold, anomalyDetected: detected },
    dur2,
  );

  return {
    agentId:     'recSignalAgent',
    displayName: DISPLAY,
    status:      'success',
    toolCalls:   [tc1, tc2],
    summary: detected
      ? `Anomaly detected — score ${anomalyScore} exceeds threshold (${threshold}). Primary signal: ${primarySignal.replace(/_/g, ' ')}.`
      : `No anomaly detected — score ${anomalyScore} within threshold (${threshold}).`,
    payload: {
      anomalyScore, threshold, anomalyDetected: detected,
      primarySignal, features,
      recommendation: detected ? 'Escalate for trace analysis' : 'Continue monitoring',
    },
  };
}

/* ── recTraceAgent → "Dependency Intelligence Agent" ─────── */

export async function recTraceAgent(userInput: string): Promise<AgentResponse> {
  await delay(700 + Math.random() * 700);

  const DISPLAY = 'Dependency Intelligence Agent';
  const isError = Math.random() < 0.10;

  if (isError) {
    const tc = buildToolCall(
      'recTraceAgent', DISPLAY,
      'correlateSpans', 'Span Correlation',
      { query: userInput },
      { error: 'Trace store returned 503 — distributed tracing unavailable' },
      1200, 'error',
    );
    return {
      agentId:     'recTraceAgent',
      displayName: DISPLAY,
      status:      'error',
      toolCalls:   [tc],
      summary:     'Dependency Intelligence could not query trace store. Service degraded.',
      payload:     { error: true, reason: 'trace_store_unavailable' },
    };
  }

  const rootCause       = pick(ROOT_CAUSES);
  const affectedService = pick(AFFECTED_SERVICES);
  const confidence      = rand(0.67, 0.97);
  const tracePool       = pick(TRACE_POOLS);
  const dur1            = Math.round(260 + Math.random() * 200);
  const dur2            = Math.round(130 + Math.random() * 120);

  const tc1 = buildToolCall(
    'recTraceAgent', DISPLAY,
    'correlateSpans', 'Span Correlation',
    { query: userInput },
    { traceIds: tracePool.ids, correlatedSpans: tracePool.spans },
    dur1,
  );

  const tc2 = buildToolCall(
    'recTraceAgent', DISPLAY,
    'identifyRoot', 'Root Cause Identification',
    { traceIds: tc1.output!.traceIds },
    { rootCause, confidence, affectedService },
    dur2,
  );

  return {
    agentId:     'recTraceAgent',
    displayName: DISPLAY,
    status:      'success',
    toolCalls:   [tc1, tc2],
    summary:     `Root cause: ${rootCause.replace(/_/g, ' ')} in ${affectedService} (confidence ${Math.round(confidence * 100)}%).`,
    payload:     { rootCause, confidence, affectedService, traceIds: tracePool.ids },
  };
}

/* ── recCheckAgent → "Release Validation Agent" ──────────── */

export async function recCheckAgent(userInput: string): Promise<AgentResponse> {
  await delay(400 + Math.random() * 500);

  const DISPLAY = 'Release Validation Agent';
  const isError = Math.random() < 0.10;

  if (isError) {
    const tc = buildToolCall(
      'recCheckAgent', DISPLAY,
      'evaluatePolicy', 'Policy Evaluation',
      { action: userInput },
      { error: 'Policy engine returned timeout — governance check incomplete' },
      450, 'error',
    );
    return {
      agentId:     'recCheckAgent',
      displayName: DISPLAY,
      status:      'error',
      toolCalls:   [tc],
      summary:     'Release Validation could not complete — policy engine unavailable.',
      payload:     { error: true, reason: 'policy_engine_timeout' },
    };
  }

  const shuffled         = [...POLICY_POOL].sort(() => Math.random() - 0.5);
  const policies         = shuffled.slice(0, Math.floor(3 + Math.random() * 3));
  const violationCount   = Math.random() < 0.18 ? Math.ceil(Math.random() * 2) : 0;
  const approved         = violationCount === 0;
  const violatingPolicies = violationCount > 0 ? policies.slice(0, violationCount) : [];
  const dur1             = Math.round(80 + Math.random() * 80);
  const dur2             = Math.round(50 + Math.random() * 60);

  const tc1 = buildToolCall(
    'recCheckAgent', DISPLAY,
    'evaluatePolicy', 'Policy Evaluation',
    { action: userInput },
    { policies, violations: violationCount, violatingPolicies },
    dur1,
  );

  const tc2 = buildToolCall(
    'recCheckAgent', DISPLAY,
    'generateApproval', 'Approval Generation',
    { violations: violationCount },
    {
      approved,
      notes: approved
        ? 'All governance checks passed.'
        : `Policy violations detected: ${violatingPolicies.join(', ')}. Escalation required.`,
    },
    dur2,
  );

  return {
    agentId:     'recCheckAgent',
    displayName: DISPLAY,
    status:      'success',
    toolCalls:   [tc1, tc2],
    summary: approved
      ? `Governance checks passed — ${policies.length} policies evaluated, 0 violations.`
      : `Governance check failed — ${violationCount} violation(s) detected. Escalation recommended.`,
    payload: { approved, violations: violationCount, policies, violatingPolicies },
  };
}

/* ── Agent registry ──────────────────────────────────────── */

export const AGENT_REGISTRY: Record<string, (input: string) => Promise<AgentResponse>> = {
  recSignalAgent,
  recTraceAgent,
  recCheckAgent,
};
