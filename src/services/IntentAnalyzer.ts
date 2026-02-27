/* ---------------------------------------------------------
 *  IntentAnalyzer -- Parse user input into IntentProfile
 *
 *  Priority order:
 *    1. Domain-specific queries  (delayed recon / high MTP / server)
 *    2. General incident / anomaly / trace / compliance / perf rules
 *    3. Fallback: full_analysis with all agents
 * --------------------------------------------------------- */

import type { AgentId, ExtractedContext, IntentProfile, IntentType, SeverityLevel } from '@/types/intent';
import { resolveInstance, resolveServer } from '@/mock/mockDomainData';

/* == Domain-specific rule table ========================== */

const DOMAIN_INTENT_RULES: Array<{
  type:     IntentType;
  agents:   AgentId[];
  useCase:  ExtractedContext['useCase'];
  keywords: string[];
}> = [
  {
    type:    'server_diagnosis',
    agents:  ['recServerAgent', 'recTraceAgent'],
    useCase: 'server_diagnosis',
    keywords: [
      'diagnosis', 'server diagnosis', 'diagnose',
      'server stats', 'server health', 'server status',
      'run diagnosis', 'check server',
    ],
  },
  {
    type:    'high_mtp_query',
    agents:  ['recSignalAgent', 'recCheckAgent'],
    useCase: 'high_mtp',
    keywords: [
      'high mtp', 'mtp accounts', 'mtp threshold', 'mtp issues',
      'mtp breach', 'accounts mtp', 'mtp in', 'mtp for',
    ],
  },
  {
    type:    'delayed_recon_query',
    agents:  ['recSignalAgent'],
    useCase: 'delayed_recon',
    keywords: [
      'delayed recon', 'delayed reconciliation', 'recon delayed',
      'delayed jobs', 'slow recon', 'recon backlog',
      'what are delayed', 'list delayed', 'show delayed',
    ],
  },
];

/* == General intent rule table =========================== */

const INTENT_RULES: Array<{
  type:    IntentType;
  agents:  AgentId[];
  keywords: string[];
}> = [
  {
    type: 'incident_response',
    agents: ['recSignalAgent', 'recTraceAgent', 'recCheckAgent'],
    keywords: ['incident', 'outage', 'down', 'offline', 'p0', 'p1', 'sev1', 'sev2',
               'production down', 'service down', 'system down'],
  },
  {
    type: 'anomaly_detection',
    agents: ['recSignalAgent', 'recCheckAgent'],
    keywords: ['anomal', 'spike', 'surge', 'drift', 'signal', 'alert',
               'threshold exceeded', 'unusual', 'deviation'],
  },
  {
    type: 'root_cause_trace',
    agents: ['recTraceAgent', 'recCheckAgent'],
    keywords: ['trace', 'root cause', 'why did', 'why is', 'chain', 'dependency',
               'span', 'upstream', 'downstream', 'propagat', 'lineage'],
  },
  {
    type: 'compliance_check',
    agents: ['recCheckAgent'],
    keywords: ['compliance', 'policy', 'governance', 'audit', 'regulation',
               'sox', 'gdpr', 'mifid', 'approved', 'violation'],
  },
  {
    type: 'performance_analysis',
    agents: ['recSignalAgent', 'recTraceAgent'],
    keywords: ['performance', 'latency', 'throughput', 'slow', 'timeout',
               'capacity', 'bottleneck', 'degraded', 'lag'],
  },
];

/* == Severity tables ====================================== */

const SEVERITY_CRITICAL = ['critical', 'p0', 'sev1', 'production down', 'total failure', 'outage', 'down'];
const SEVERITY_HIGH     = ['p1', 'sev2', 'production', 'fail', 'failed', 'failing', 'incident', 'broken', 'offline'];
const SEVERITY_LOW      = ['check', 'review', 'audit', 'yesterday', 'historical', 'last week', 'scheduled'];

/* == Domain label table =================================== */

const DOMAIN_RULES: Array<{ pattern: RegExp; domain: string }> = [
  { pattern: /fx|foreign.?exchange|forex/i,            domain: 'FX Operations'         },
  { pattern: /recon|reconcil/i,                        domain: 'Reconciliation'        },
  { pattern: /payment|settle|clearing/i,               domain: 'Payment & Settlement'  },
  { pattern: /equity|blotter|trade execution/i,        domain: 'Equity Operations'     },
  { pattern: /position|portfolio|pnl/i,                domain: 'Portfolio Management'  },
  { pattern: /batch|overnight|scheduled|end.of.day/i,  domain: 'Batch Processing'      },
  { pattern: /deploy|release|version|pipeline|build/i, domain: 'Release Engineering'   },
  { pattern: /order|routing|matching|exchange/i,       domain: 'Order Management'      },
  { pattern: /report|feed|data|market.data/i,          domain: 'Data Services'         },
  { pattern: /\b(inv|snpb|icg)\b/i,                   domain: 'Reconciliation'        },
];

/* == Helpers ============================================== */

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

/* == Main export ========================================== */

/**
 * Analyse a user prompt and return a structured IntentProfile.
 *
 * Domain-specific use cases (delayed_recon / high_mtp / server_diagnosis)
 * are checked first. Each carries extracted context (instance / server)
 * that domain-aware agents consume to return structured data.
 */
export function analyzeIntent(userInput: string): IntentProfile {
  const lower = userInput.toLowerCase();

  /* --- 1. Domain-specific intent check (highest priority) --- */
  for (const rule of DOMAIN_INTENT_RULES) {
    const hits = extractKeywords(lower, rule.keywords);
    if (hits.length === 0) continue;

    const extractedContext: ExtractedContext = { useCase: rule.useCase };

    if (rule.useCase === 'server_diagnosis') {
      const server = resolveServer(userInput);
      if (server) {
        extractedContext.serverId   = server.id;
        extractedContext.instanceId = server.instanceRef;
      }
    } else {
      const instance = resolveInstance(userInput);
      if (instance) {
        extractedContext.instanceId = instance.id;
        extractedContext.serverId   = instance.serverRef;
      }
    }

    const domain = detectDomain(userInput);

    return {
      type:            rule.type,
      severity:        detectSeverity(lower),
      agentsToInvoke:  [...rule.agents],
      primaryKeywords: hits,
      domain,
      extractedContext,
    };
  }

  /* --- 2. General intent rules (priority order) --- */
  let matchedType: IntentType    = 'full_analysis';
  let matchedAgents: AgentId[]   = ['recSignalAgent', 'recTraceAgent', 'recCheckAgent'];
  let matchedKeywords: string[]  = [];

  for (const rule of INTENT_RULES) {
    const hits = extractKeywords(lower, rule.keywords);
    if (hits.length > 0) {
      matchedType     = rule.type;
      matchedAgents   = [...rule.agents];
      matchedKeywords = hits;
      break;
    }
  }

  /* 3. Critical severity forces full pipeline regardless of base intent */
  const severity = detectSeverity(lower);
  if (severity === 'critical' && matchedType !== 'full_analysis') {
    matchedAgents = ['recSignalAgent', 'recTraceAgent', 'recCheckAgent'];
  }

  /* 4. Compliance agent always goes last when combined */
  const checkIdx = matchedAgents.indexOf('recCheckAgent');
  if (checkIdx !== -1 && matchedAgents.length > 1) {
    matchedAgents.splice(checkIdx, 1);
    matchedAgents.push('recCheckAgent');
  }

  return {
    type:            matchedType,
    severity,
    agentsToInvoke:  matchedAgents,
    primaryKeywords: matchedKeywords,
    domain:          detectDomain(userInput),
  };
}
