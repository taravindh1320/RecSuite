# RecSuite MVP Architecture

## Overview

RecSuite is a React-based autonomous control panel that simulates a multi-agent orchestration system. It accepts natural language input, routes execution through specialized mock agents, and presents a structured analysis report.

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | CSS Modules (dark enterprise theme) |
| Orchestration | `runControlCycle` service (pure TS) |
| Agent logic | Mock agents with randomized simulation |
| State | React `useState` — no external state library |

---

## System Flow

```
User Input
    │
    ▼
IntentAnalyzer.analyzeIntent(input)
    │  → Produces IntentProfile (type, severity, agentsToInvoke, domain)
    │
    ▼
Orchestrator (runControlCycle)
    │  → Emits onPlanning(profile)
    │  → Resolves agent functions from AGENT_REGISTRY
    │
    ▼
Sequential Agent Execution
    │  → Each agent runs, returns AgentResponse
    │  → onAgentStart / onAgentComplete callbacks fire per agent
    │
    ▼
Synthesis
    │  → synthesizeSummary() builds prose from all responses
    │  → buildReportData() structures findings, impact, actions
    │  → onSynthesis callback fires
    │
    ▼
Report Rendering
       → reportData passed to Chat → ReportPanel renders structured output
```

---

## Core Modules

### `IntentAnalyzer` — `src/services/IntentAnalyzer.ts`

Parses raw user input into a typed `IntentProfile`. Uses keyword matching rules ordered by priority (incident → anomaly → trace → compliance → performance → full_analysis). Determines which agents to invoke and derives domain context from the input text.

### `Orchestrator` — `src/services/orchestrator.ts`

Exports `runControlCycle(userInput, callbacks)`. Single entry point for a full execution cycle. Calls `analyzeIntent`, resolves agents via `AGENT_REGISTRY`, runs them sequentially to produce visible step-by-step progression, then synthesizes `ReportData` from all responses.

### `AgentFlowCanvas` — `src/components/AgentFlowCanvas/`

SVG-based directed graph rendering the delegation chain: Orchestrator → Agent nodes → Synthesis. Layout is computed dynamically from the `agentsToInvoke` list. A dot-travel animation (`<animateMotion>`) fires per agent completion and again during synthesis convergence.

### `ReportPanel` — `src/components/ReportPanel/`

Stateless component that renders a `ReportData` object as a structured report card. Sections: header (title, severity badge, domain, timestamp), summary, key findings table with status indicators, impact scope, and recommended actions.

### `ToolLog` — `src/components/ToolLog/`

Displays the raw `ToolCall` records emitted by agents. Each entry shows the tool name, input/output payload, duration, and pass/fail status. Collapsible panel on the right column.

---

## Execution States

The `ExecutionState` type drives both UI appearance and animation logic across all components.

| State | Meaning |
|---|---|
| `idle` | No active execution. Input bar is enabled. AgentFlowCanvas shows inactive graph. |
| `planning` | `analyzeIntent` has resolved. Orchestrator node activates. Intent profile is set. |
| `executing` | One or more agents are running. Agent nodes activate in sequence. Dot travels from Orchestrator to each agent as it completes. |
| `synthesizing` | All agents have returned. Synthesis node activates. Dots travel from agent nodes toward Synthesis. |
| `complete` | Full cycle finished. All nodes turn green. ReportPanel renders. |
| `error` | An unhandled exception occurred in the control cycle. The last active node turns red. |

> Individual agent failures (10% simulated rate) do not set `ExecutionState` to `error`. They are reflected as `status: 'error'` on the agent's node and as an error finding in the report.

---

## Directory Structure

```
src/
├── components/
│   ├── AgentFlowCanvas/    # SVG execution graph
│   ├── AgentGraph/         # Vertical stepper timeline
│   ├── Chat/               # Conversation + input bar + ReportPanel mount
│   ├── ReportPanel/        # Structured report card
│   └── ToolLog/            # Tool call inspection panel
├── mock/
│   └── mockAgents.ts       # Three mock agent implementations + AGENT_REGISTRY
├── pages/
│   └── Dashboard.tsx       # Layout owner, all state, lifecycle wiring
├── services/
│   ├── IntentAnalyzer.ts   # Input → IntentProfile
│   └── orchestrator.ts     # runControlCycle
└── types/
    ├── agent.ts            # AgentResponse, AgentNode, ReportData, OrchestrationResult
    ├── execution.ts        # ExecutionState
    └── intent.ts           # IntentProfile, IntentType, SeverityLevel, AgentId
```
