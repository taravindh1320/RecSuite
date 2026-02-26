# UI Behavior Specification

## Layout Structure

The dashboard uses a fixed two-row grid layout:

```
┌─────────────────────────────────────────────────────────────┐
│  Top row (flex: 1, min-height 0)                            │
│  ┌─────────────────┬──────────────┬────────────────────┐    │
│  │  Conversation   │  Execution   │  Operations Log    │    │
│  │  (45fr)         │  Timeline    │  (20fr)            │    │
│  │                 │  (35fr)      │  collapsible       │    │
│  └─────────────────┴──────────────┴────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Bottom panel (fixed ~220px)                                │
│  AgentFlowCanvas — SVG execution graph                      │
└─────────────────────────────────────────────────────────────┘
```

### Left — Conversation (`Chat`)

- Displays the message thread (user, system, assistant roles)
- System messages appear as inline status annotations without a role label
- A step divider line renders between a system message run and the next user turn
- After execution completes, `ReportPanel` renders below the thread
- Input bar is disabled during active execution

### Center — Execution Timeline (`AgentGraph`)

- Vertical stepper showing each agent node as it is added to the `nodes` array
- Nodes appear in execution order with status indicators (pending, active, complete, error)
- Driven entirely by the `nodes: AgentNode[]` and `executionState` props

### Right — Operations Log (`ToolLog`)

- Lists each `ToolCall` emitted by every agent during execution
- Shows: tool name, agent name, input/output payloads, duration (ms), status
- Collapsible; collapsed state shows a summary count
- Scrollable independently of the other panels

---

## Animation Logic

### AgentFlowCanvas

The canvas renders a directed graph: `[Orchestrator] → [Agent nodes] → [Synthesis]`.

Node positions are computed dynamically based on the number of agents invoked:

| Agent count | Y-positions |
|---|---|
| 1 | `[80]` (centered) |
| 2 | `[50, 110]` |
| 3 | `[28, 80, 132]` |

Cubic Bézier paths are built programmatically from these Y values. The viewBox is fixed at `0 0 560 160`.

### Node Activation

Node appearance maps directly to `NodeStatus`:

| Status | Stroke | Fill | Filter |
|---|---|---|---|
| `idle` | `#1e3a4a` | near-transparent dark | none |
| `active` | `#14b8a6` (teal) | teal tint | `glowCyan` blur |
| `complete` | `#0d9488` (dark teal) | faint teal tint | none |
| `error` | `#ef4444` (red) | red tint | `glowRed` blur |

### Pulse Transfer (Dot Animation)

A single `<circle>` element with `<animateMotion>` traces along a `<path>` defined in `<defs>`. Each animation fires by incrementing a `key` prop, forcing React to remount and replay the SVG animation.

- **On agent complete:** dot travels `Orchestrator → agent node`
- **On synthesizing:** dot travels from the last completed agent node → `Synthesis`; a second dot follows from another completed agent after 300ms

The dot color is `#22d3ee` with a gaussian blur glow filter.

### Error State

When `ExecutionState` is `error`:
- The last agent node that had not yet completed is set to `NodeStatus: 'error'`
- If all agents completed, the Synthesis node is marked error
- Edge lines originating from that node dim and remain dashed

Individual agent failures (`AgentResponse.status === 'error'`) display as red nodes without affecting overall `ExecutionState`.

---

## Report Rendering

When execution completes, the orchestrator returns a `ReportData` object. This is passed from `Dashboard` → `Chat` → `ReportPanel`.

The report is **not** rendered as a chat message. It renders as a structured card below the conversation thread.

### ReportPanel Sections

| Section | Content |
|---|---|
| Header | Report title, severity badge, domain tag, execution timestamp |
| Summary | Single paragraph synthesised from all agent outcomes |
| Key Findings | Table of label / value / status-dot rows (intent, severity, per-agent results) |
| Impact Scope | Bullet list of affected services or pipeline components |
| Recommended Actions | Ordered list of next steps derived from agent outcomes |

### Severity Badge Colors

| Level | Color |
|---|---|
| `low` | Teal (`#4ecdc4`) |
| `medium` | Yellow (`#ffdd57`) |
| `high` | Orange (`#ff9800`) |
| `critical` | Red (`#ff5252`) |

### Finding Status Dots

| Status | Color | Meaning |
|---|---|---|
| `ok` | Teal | Check passed, no issues |
| `warn` | Yellow | Threshold exceeded or elevated concern |
| `error` | Red | Failure, violation, or agent error |
| `info` | Cyan | Informational classification result |

---

## Input Handling

- Submitting an empty or whitespace-only input is a no-op
- While `isProcessing` is true, the input field and send button are disabled
- On send, `nodes`, `toolCalls`, and `reportData` state are all reset before the new cycle starts
- A new `reportData` replaces the previous report on each completion
