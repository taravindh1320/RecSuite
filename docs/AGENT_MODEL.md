# Agent Model

## Parent Agent — Orchestrator

The orchestrator is not implemented as a discrete agent object. It is the `runControlCycle` function in `src/services/orchestrator.ts`. Its responsibilities:

- Accept raw user input
- Delegate intent analysis to `IntentAnalyzer`
- Resolve and invoke the appropriate child agents in order
- Collect all `AgentResponse` objects
- Synthesize a `ReportData` structure from the combined results
- Emit lifecycle callbacks at each transition for UI synchronisation

The orchestrator does not produce an `AgentResponse` itself. It produces an `OrchestrationResult`.

---

## Child Agents

All child agents are implemented in `src/mock/mockAgents.ts` and exported via `AGENT_REGISTRY`.

### Monitoring Agent — `recSignalAgent`

Simulates signal-level anomaly detection. Extracts features from the input and scores an anomaly probability against a threshold.

**Tool calls produced:**
1. `extractFeatures` — returns a random feature set (3 signal names) and sampling window
2. `scoreAnomaly` — returns anomaly score, threshold, and detection flag

**Failure mode:** Feed timeout (upstream data source unresponsive).

---

### Dependency Intelligence Agent — `recTraceAgent`

Simulates distributed trace correlation and root cause identification.

**Tool calls produced:**
1. `correlateSpans` — returns correlated trace IDs and span count
2. `identifyRoot` — returns root cause label, confidence score, and affected service name

**Failure mode:** Trace store returned 503 (distributed tracing unavailable).

---

### Release Validation Agent — `recCheckAgent`

Simulates governance and policy evaluation. Checks a randomised set of policies and determines approval status.

**Tool calls produced:**
1. `evaluatePolicy` — returns evaluated policy list and violation count
2. `generateApproval` — returns approval flag and descriptive notes

**Failure mode:** Policy engine timeout (governance check incomplete).

---

## AgentResponse Structure

Every agent returns an `AgentResponse`:

```typescript
interface AgentResponse {
  agentId:     string;           // e.g. 'recSignalAgent'
  displayName: string;           // e.g. 'Monitoring Agent'
  status:      'success' | 'error';
  toolCalls:   ToolCall[];
  summary:     string;           // Human-readable outcome sentence
  payload:     Record<string, unknown>; // Agent-specific result data
}
```

**Example — Monitoring Agent success:**

```json
{
  "agentId": "recSignalAgent",
  "displayName": "Monitoring Agent",
  "status": "success",
  "toolCalls": [
    {
      "id": "tc-1740000000000-1",
      "agentId": "recSignalAgent",
      "agentDisplayName": "Monitoring Agent",
      "toolId": "extractFeatures",
      "operationLabel": "Feature Extraction",
      "input": { "text": "Are there active anomalies right now?" },
      "output": { "features": ["vol_spike", "latency_drift", "book_imbalance"], "count": 3, "samplingWindowMs": 1000 },
      "status": "success",
      "startedAt": 1740000000000,
      "durationMs": 243
    },
    {
      "id": "tc-1740000000243-2",
      "agentId": "recSignalAgent",
      "agentDisplayName": "Monitoring Agent",
      "toolId": "scoreAnomaly",
      "operationLabel": "Anomaly Analysis",
      "input": { "features": ["vol_spike", "latency_drift", "book_imbalance"] },
      "output": { "anomalyScore": 0.83, "threshold": 0.75, "anomalyDetected": true },
      "status": "success",
      "startedAt": 1740000000243,
      "durationMs": 141
    }
  ],
  "summary": "Anomaly detected — score 0.83 exceeds threshold (0.75). Primary signal: vol spike.",
  "payload": {
    "anomalyScore": 0.83,
    "threshold": 0.75,
    "anomalyDetected": true,
    "primarySignal": "vol_spike",
    "features": ["vol_spike", "latency_drift", "book_imbalance"],
    "recommendation": "Escalate for trace analysis"
  }
}
```

---

## Simulated Failure Rate

Each agent has a 10% probability per invocation of returning `status: 'error'`. On failure:

- Only one tool call is produced, with `status: 'error'`
- The `AgentResponse.status` is set to `'error'`
- The orchestrator continues executing remaining agents
- The failure is captured as a finding in `ReportData`
- The agent's node in `AgentFlowCanvas` renders in red

---

## AGENT_REGISTRY

Agents are resolved by string ID via a flat map, allowing the orchestrator to invoke them dynamically from any `agentsToInvoke` list without hardcoded imports.

```typescript
export const AGENT_REGISTRY: Record<string, (input: string) => Promise<AgentResponse>> = {
  recSignalAgent,
  recTraceAgent,
  recCheckAgent,
};
```
