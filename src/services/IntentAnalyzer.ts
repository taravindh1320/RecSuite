/* ─────────────────────────────────────────────────────────
 *  IntentAnalyzer — Parse user input into IntentProfile
 *
 *  Implements keyword-based intent classification with:
 *    - Intent type detection (6 types)
 *    - Severity scoring (low → critical)
 *    - Dynamic agent list composition
 *    - Business domain extraction
 *
 *  Different prompts → different IntentProfiles →
 *  different agent combinations and execution paths.
 * ───────────────────────────────────────────────────────── */

import type { AgentId, IntentProfile, IntentType, SeverityLevel } from '@/types/intent';

/* ── Keyword tables ──────────────────────────────────────── */

const INTENT_RULES: Array<{
  type: IntentType;
  agents: AgentId[];
  keywords: string[];
}> = [
  {
    type: 'incident_response',
    agents: ['recSignalAgent', 'recTraceAgent', 'recCheckAgent'],
    keywords: ['incident', 'outage', 'down', 'offline', 'p0', 'p1', 'sev1', 'sev2', 'production down', 'service down', 'system down'],
  },
  {
    type: 'anomaly_detection',
    agents: ['recSignalAgent', 'recCheckAgent'],
    keywords: ['anomal', 'spike', 'surge', 'drift', 'signal', 'alert', 'threshold exceeded', 'unusual', 'deviation'],
  },
  {
    type: 'root_cause_trace',
    agents: ['recTraceAgent', 'recCheckAgent'],
    keywords: ['trace', 'root cause', 'why did', 'why is', 'chain', 'dependency', 'span', 'upstream', 'downstream', 'propagat'],
  },
  {
    type: 'compliance_check',
    agents: ['recCheckAgent'],
    keywords: ['compliance', 'policy', 'governance', 'audit', 'regulation', 'sox', 'gdpr', 'mifid', 'approved', 'violation'],
  },
  {
    type: 'performance_analysis',
    agents: ['recSignalAgent', 'recTraceAgent'],
    keywords: ['performance', 'latency', 'throughput', 'slow', 'timeout', 'capacity', 'bottleneck', 'degraded', 'lag'],
  },
];

const SEVERITY_CRITICAL = [
  'critical', 'p0', 'sev1', 'production down', 'total failure', 'all services', 'outage', 'down',
];
const SEVERITY_HIGH = [
  'p1', 'sev2', 'production', 'fail', 'failed', 'failing', 'incident', 'broken', 'offline',
];
const SEVERITY_LOW = [
  'check', 'review', 'audit', 'yesterday', 'historical', 'previous', 'last week', 'scheduled',
];

const DOMAIN_RULES: Array<{ pattern: RegExp; domain: string }> = [
  { pattern: /fx|foreign.?exchange|forex/i,             domain: 'FX Operations'         },
  { pattern: /recon|reconcil/i,                         domain: 'Reconciliation'        },
  { pattern: /payment|settle|clearing/i,                domain: 'Payment & Settlement'  },
  { pattern: /equity|blotter|trade execution/i,         domain: 'Equity Operations'     },
  { pattern: /position|portfolio|pnl/i,                 domain: 'Portfolio Management'  },
  { pattern: /batch|overnight|scheduled|end.of.day/i,   domain: 'Batch Processing'      },
  { pattern: /deploy|release|version|pipeline|build/i,  domain: 'Release Engineering'   },
  { pattern: /order|routing|matching|exchange/i,        domain: 'Order Management'      },
  { pattern: /report|feed|data|market.data/i,           domain: 'Data Services'         },
];

/* ── Helpers ─────────────────────────────────────────────── */

function extractKeywords(lower: string, candidates: string[]): string[] {
  return candidates.filter((kw) => lower.includes(kw));
}

function detectSeverity(lower: string): SeverityLevel {
  if (extractKeywords(lower, SEVERITY_CRITICAL).length > 0) return 'critical';
  if (extractKeywords(lower, SEVERITY_HIGH).length > 0) return 'high';
  if (extractKeywords(lower, SEVERITY_LOW).length > 0) return 'low';
  return 'medium';
}

function detectDomain(input: string): string {
  for (const rule of DOMAIN_RULES) {
    if (rule.pattern.test(input)) return rule.domain;
  }
  return 'Operations';
}

/* ── Main export ─────────────────────────────────────────── */

/**
 * Analyse a user prompt and return a structured IntentProfile.
 * Every field of the profile drives a different behaviour in
 * the orchestrator and visualization layer — no two profiles
 * with different inputs need produce the same agent list.
 */
export function analyzeIntent(userInput: string): IntentProfile {
  const lower = userInput.toLowerCase();

  /* 1. Match against intent rules in priority order */
  let matchedType: IntentType = 'full_analysis';
  let matchedAgents: AgentId[] = ['recSignalAgent', 'recTraceAgent', 'recCheckAgent'];
  let matchedKeywords: string[] = [];

  for (const rule of INTENT_RULES) {
    const hits = extractKeywords(lower, rule.keywords);
    if (hits.length > 0) {
      matchedType    = rule.type;
      matchedAgents  = [...rule.agents];
      matchedKeywords = hits;
      break;
    }
  }

  /* 2. Severity-based agent augmentation:
   *    critical incidents always get full pipeline regardless of base intent */
  const severity = detectSeverity(lower);
  if (severity === 'critical' && matchedType !== 'full_analysis') {
    matchedAgents = ['recSignalAgent', 'recTraceAgent', 'recCheckAgent'];
  }

  /* 3. Compliance always goes last when combined */
  const checkIdx = matchedAgents.indexOf('recCheckAgent');
  if (checkIdx !== -1 && matchedAgents.length > 1) {
    matchedAgents.splice(checkIdx, 1);
    matchedAgents.push('recCheckAgent');
  }

  return {
    type: matchedType,
    severity,
    agentsToInvoke: matchedAgents,
    primaryKeywords: matchedKeywords,
    domain: detectDomain(userInput),
  };
}
