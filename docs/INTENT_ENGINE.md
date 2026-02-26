# Intent Engine Design

## Overview

The intent engine is a deterministic keyword-based classifier. It takes raw user input and produces a typed `IntentProfile` that controls which agents run, in what order, and how the report is framed.

> **This is mock logic.** There is no LLM or ML model involved. Classification is done with priority-ordered rule tables against lowercased input text.

---

## IntentProfile Structure

```typescript
type IntentType =
  | 'anomaly_detection'
  | 'root_cause_trace'
  | 'compliance_check'
  | 'performance_analysis'
  | 'incident_response'
  | 'full_analysis';

type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

type AgentId = 'recSignalAgent' | 'recTraceAgent' | 'recCheckAgent';

interface IntentProfile {
  type:            IntentType;
  severity:        SeverityLevel;
  agentsToInvoke:  AgentId[];
  primaryKeywords: string[];   // matched terms from input
  domain:          string;     // e.g. 'FX Reconciliation', 'Payment & Settlement'
}
```

---

## Classification Rules

Rules are evaluated in priority order. The first match wins.

| Priority | IntentType | Trigger keywords |
|---|---|---|
| 1 | `incident_response` | `incident`, `outage`, `p0`, `down`, `critical failure` |
| 2 | `anomaly_detection` | `anomal`, `signal`, `spike`, `drift`, `deviation` |
| 3 | `root_cause_trace` | `trace`, `root cause`, `lineage`, `dependency`, `upstream` |
| 4 | `compliance_check` | `compliance`, `policy`, `governance`, `audit`, `regulation` |
| 5 | `performance_analysis` | `performance`, `latency`, `slow`, `throughput`, `degraded` |
| 6 | `full_analysis` | _(default — no specific match)_ |

---

## Agent Selection

Each `IntentType` maps to a fixed subset of agents:

| IntentType | Agents invoked |
|---|---|
| `incident_response` | `recSignalAgent`, `recTraceAgent`, `recCheckAgent` |
| `anomaly_detection` | `recSignalAgent`, `recCheckAgent` |
| `root_cause_trace` | `recTraceAgent`, `recCheckAgent` |
| `compliance_check` | `recCheckAgent` |
| `performance_analysis` | `recSignalAgent`, `recTraceAgent` |
| `full_analysis` | `recSignalAgent`, `recTraceAgent`, `recCheckAgent` |

`recCheckAgent` is always placed last when combined with other agents.

---

## Severity Scoring

Severity modulates report framing and badge display. It does not currently change the agent set.

| SeverityLevel | Trigger keywords |
|---|---|
| `critical` | `outage`, `down`, `p0`, `critical`, `total failure` |
| `high` | `fail`, `production`, `prod`, `p1`, `broken`, `urgent` |
| `medium` | _(default)_ |
| `low` | `audit`, `review`, `historical`, `last week`, `report` |

---

## Domain Extraction

The domain field is extracted from 9 keyword patterns. It appears in the report header and summary.

| Domain label | Trigger keywords |
|---|---|
| FX Reconciliation | `fx`, `foreign exchange` |
| Payment & Settlement | `payment`, `settlement`, `pnl` |
| Reconciliation | `recon`, `reconciliation` |
| Batch Processing | `batch`, `job`, `nightly` |
| Trade Lifecycle | `trade`, `booking`, `lifecycle` |
| Risk & Exposure | `risk`, `exposure`, `limit` |
| Market Data | `market data`, `feed`, `price` |
| Position Management | `position`, `inventory` |
| Reference Data | `reference`, `static data` |
| _(general)_ | _(no match)_ |

---

## Example

**Input:** `"Why did yesterday's FX reconciliation fail?"`

**Classification process:**
1. No `incident`/`outage` keywords → skip incident_response
2. No `anomal`/`signal` → skip anomaly_detection
3. No `trace`/`dependency` → skip root_cause_trace
4. No `compliance`/`policy` → skip compliance_check
5. No `latency`/`slow` → skip performance_analysis
6. Default → `full_analysis`
7. Severity: `fail` → `high`
8. Domain: `fx` → `FX Reconciliation`

**Result:**

```json
{
  "type": "full_analysis",
  "severity": "high",
  "agentsToInvoke": ["recSignalAgent", "recTraceAgent", "recCheckAgent"],
  "primaryKeywords": ["fail", "fx", "reconciliation"],
  "domain": "FX Reconciliation"
}
```

---

## Extending the Engine

To add a new intent type:

1. Add the type to `IntentType` in `src/types/intent.ts`
2. Add a rule entry to `INTENT_RULES` in `src/services/IntentAnalyzer.ts`
3. Add the agent mapping to the switch in `analyzeIntent`

To integrate a real LLM: replace the body of `analyzeIntent` with an API call that returns the same `IntentProfile` shape. No other files need to change.
