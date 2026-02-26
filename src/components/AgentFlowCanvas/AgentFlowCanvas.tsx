/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *  AgentFlowCanvas â€” Agent delegation flow visualisation
 *
 *  Renders a structured parent â†’ child agent graph:
 *
 *    [Orchestrator] â”€â”€â–º [Agent A         ]
 *                   â”€â”€â–º [Agent B         ] â”€â”€â–º [Synthesis]
 *                   â”€â”€â–º [Agent C         ]
 *
 *  Agent set is driven by `agentsToInvoke` prop so the graph
 *  automatically reflects the intent-resolved agent list.
 *
 *  Execution state drives:
 *    planning      â†’ Orchestrator glows
 *    executing     â†’ dot travels Orchestrator â†’ each new agent
 *    synthesizing  â†’ dot travels last agent â†’ Synthesis
 *    complete      â†’ all nodes soft green
 *    error         â†’ last active node turns red
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

import { useEffect, useRef, useState } from 'react';
import type { AgentNode } from '@/types/agent';
import type { ExecutionState } from '@/types/execution';
import styles from './AgentFlowCanvas.module.css';

interface AgentFlowCanvasProps {
  state: ExecutionState;
  nodes: AgentNode[];
  agentsToInvoke?: string[];  // e.g. ['recSignalAgent','recCheckAgent']
}

/* â”€â”€ Agent display metadata â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const AGENT_META: Record<string, { lines: string[] }> = {
  recSignalAgent: { lines: ['Monitoring', 'Agent']          },
  recTraceAgent:  { lines: ['Dependency', 'Intelligence']   },
  recCheckAgent:  { lines: ['Release', 'Validation']        },
};

/** Convert agentId â†’ stable nodeKey used in statuses map */
function agentIdToKey(id: string): string {
  return id.replace(/^rec/, '').toLowerCase();
}

/* â”€â”€ Default three-agent list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const DEFAULT_AGENTS = ['recSignalAgent', 'recTraceAgent', 'recCheckAgent'];

/* â”€â”€ Compute Y-positions for agent column â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function agentYPositions(count: number): number[] {
  if (count === 1) return [80];
  if (count === 2) return [50, 110];
  return [28, 80, 132];  // 3 or more (cap at 3 for fixed viewBox)
}

/* â”€â”€ Build dynamic layout from agentsToInvoke â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

interface NodeDef {
  id:    string;           // internal node key
  lines: string[];
  cx: number; cy: number;
  w:  number; h:  number;
}

interface Layout {
  nodeDefs:  NodeDef[];
  edgePaths: Record<string, string>;
}

function buildLayout(agentIds: string[]): Layout {
  const ys = agentYPositions(Math.min(agentIds.length, 3));

  const nodeDefs: NodeDef[] = [
    { id: 'orchestrator', lines: ['Orchestrator'], cx: 72,  cy: 80, w: 100, h: 36 },
  ];

  const edgePaths: Record<string, string> = {};

  agentIds.slice(0, 3).forEach((id, i) => {
    const key = agentIdToKey(id);
    const cy  = ys[i];
    nodeDefs.push({
      id:    key,
      lines: AGENT_META[id]?.lines ?? [id.replace(/^rec/, '')],
      cx:    250, cy, w: 120, h: 30,
    });
    // Orchestrator â†’ agent
    edgePaths[`orc-${key}`] = `M 122 80 C 155 80 155 ${cy} 190 ${cy}`;
    // agent â†’ synthesis
    edgePaths[`${key}-synthesis`] = `M 310 ${cy} C 375 ${cy} 375 80 440 80`;
  });

  nodeDefs.push(
    { id: 'synthesis', lines: ['Synthesis'], cx: 490, cy: 80, w: 100, h: 36 },
  );

  return { nodeDefs, edgePaths };
}

/* â”€â”€ matchAgent: display label â†’ node key â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function matchAgent(label: string, nodeIds: string[]): string {
  const l = label.toLowerCase();
  if (l.includes('monitor') || l.includes('signal')) {
    return nodeIds.find((id) => id.startsWith('signal')) ?? '';
  }
  if (l.includes('depend') || l.includes('trace') || l.includes('intelligence')) {
    return nodeIds.find((id) => id.startsWith('trace')) ?? '';
  }
  if (l.includes('release') || l.includes('valid') || l.includes('check')) {
    return nodeIds.find((id) => id.startsWith('check')) ?? '';
  }
  return '';
}

/* â”€â”€ Node status type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

type NodeStatus = 'idle' | 'active' | 'complete' | 'error';
type NodeStatuses = Record<string, NodeStatus>;

function deriveStatuses(
  state:       ExecutionState,
  nodes:       AgentNode[],
  agentNodeIds: string[],
): NodeStatuses {
  const s: NodeStatuses = { orchestrator: 'idle', synthesis: 'idle' };
  for (const id of agentNodeIds) s[id] = 'idle';

  if (state === 'idle') return s;

  if (state === 'planning') {
    s.orchestrator = 'active';
    return s;
  }

  s.orchestrator = 'complete';

  for (const n of nodes) {
    const id = matchAgent(n.label, agentNodeIds);
    if (!id) continue;
    s[id] = n.status === 'error' ? 'error' : 'complete';
  }

  if (state === 'executing' && nodes.length === 0) {
    s.orchestrator = 'active';
  }

  if (state === 'synthesizing') s.synthesis = 'active';
  if (state === 'complete')     s.synthesis = 'complete';

  if (state === 'error') {
    const lastIncomplete = agentNodeIds.find((id) => s[id] === 'idle');
    if (lastIncomplete) s[lastIncomplete] = 'error';
    else                s.synthesis       = 'error';
  }

  return s;
}

/* â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function AgentFlowCanvas({
  state,
  nodes,
  agentsToInvoke,
}: AgentFlowCanvasProps) {
  const resolvedAgents = (agentsToInvoke && agentsToInvoke.length > 0)
    ? agentsToInvoke
    : DEFAULT_AGENTS;

  const { nodeDefs, edgePaths } = buildLayout(resolvedAgents);
  const agentNodeIds = resolvedAgents
    .slice(0, 3)
    .map((id) => agentIdToKey(id));

  const statuses = deriveStatuses(state, nodes, agentNodeIds);

  const [dotPathId, setDotPathId] = useState<string | null>(null);
  const [dotKey,    setDotKey]    = useState(0);
  const prevNodeCountRef          = useRef(0);
  const prevStateRef              = useRef<ExecutionState>('idle');
  const synthAnimatedRef          = useRef(false);

  const fire = (pathId: string) => {
    if (!edgePaths[pathId]) return;
    setDotPathId(pathId);
    setDotKey((k) => k + 1);
  };

  /* React to new completed agent nodes */
  useEffect(() => {
    const prev = prevNodeCountRef.current;
    const cur  = nodes.length;
    if (cur > prev) {
      const newNode = nodes[cur - 1];
      const agentId = matchAgent(newNode.label, agentNodeIds);
      if (agentId) fire(`orc-${agentId}`);
    }
    prevNodeCountRef.current = cur;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  /* React to state transitions */
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;

    if (state === 'synthesizing' && prev !== 'synthesizing') {
      synthAnimatedRef.current = false;
    }

    if (state === 'synthesizing' && !synthAnimatedRef.current) {
      synthAnimatedRef.current = true;
      const lastNode = nodes[nodes.length - 1];
      const src     = lastNode
        ? (matchAgent(lastNode.label, agentNodeIds) || agentNodeIds[0])
        : agentNodeIds[0];
      fire(`${src}-synthesis`);
      setTimeout(() => {
        const others = agentNodeIds.filter(
          (id) => id !== src && statuses[id] === 'complete',
        );
        if (others[0]) fire(`${others[0]}-synthesis`);
      }, 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /* â”€â”€ Helpers for appearance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const nodeStroke = (id: string) => {
    const st = statuses[id];
    if (st === 'active')   return '#14b8a6';
    if (st === 'complete') return '#0d9488';
    if (st === 'error')    return '#ef4444';
    return '#1e3a4a';
  };

  const nodeFill = (id: string) => {
    const st = statuses[id];
    if (st === 'active')   return 'rgba(20,184,166,0.10)';
    if (st === 'complete') return 'rgba(13,148,136,0.07)';
    if (st === 'error')    return 'rgba(239,68,68,0.10)';
    return 'rgba(11,19,36,0.9)';
  };

  const nodeFilter = (id: string) => {
    const st = statuses[id];
    if (st === 'active') return 'url(#glowCyan)';
    if (st === 'error')  return 'url(#glowRed)';
    return 'none';
  };

  const labelColor = (id: string) => {
    const st = statuses[id];
    if (st === 'active')   return '#5eead4';
    if (st === 'complete') return '#7dbdb4';
    if (st === 'error')    return '#fca5a5';
    return '#475569';
  };

  const edgeStroke = (pathId: string) => {
    const [src, tgt] = pathId.split('-');
    const srcDone = statuses[src] === 'complete' || statuses[src] === 'active';
    const tgtDone = statuses[tgt] === 'complete' || statuses[tgt] === 'active';
    if (srcDone && tgtDone) return '#0d9488';
    if (srcDone)             return '#164e41';
    return '#0f2030';
  };

  /* â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  return (
    <section className={`${styles.container} ${styles[state] ?? ''}`}>
      <svg
        viewBox="0 0 560 160"
        preserveAspectRatio="xMidYMid meet"
        className={styles.svg}
      >
        <defs>
          <filter id="glowCyan" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowRed" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="dotGlow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#0d9488" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.6" />
          </linearGradient>
          {/* Travel paths for dot animation */}
          {Object.entries(edgePaths).map(([id, d]) => (
            <path key={id} id={`tp-${id}`} d={d} fill="none" />
          ))}
        </defs>

        {/* â”€â”€ Edge lines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {Object.entries(edgePaths).map(([id, d]) => (
          <path
            key={id}
            d={d}
            fill="none"
            stroke={edgeStroke(id)}
            strokeWidth="0.8"
            strokeDasharray={statuses[id.split('-')[0]] === 'idle' ? '3 4' : undefined}
            opacity={statuses[id.split('-')[0]] === 'idle' ? 0.4 : 0.85}
          />
        ))}

        {/* â”€â”€ Nodes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {nodeDefs.map(({ id, lines, cx, cy, w, h }) => (
          <g key={id}>
            <rect
              x={cx - w / 2} y={cy - h / 2}
              width={w} height={h}
              rx="8"
              fill={nodeFill(id)}
              stroke={nodeStroke(id)}
              strokeWidth="1"
              filter={nodeFilter(id)}
            />
            {lines.length === 1 ? (
              <text x={cx} y={cy}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="8.5" fontWeight="600"
                fill={labelColor(id)} fontFamily="inherit" letterSpacing="0.04em"
              >
                {lines[0]}
              </text>
            ) : (
              <>
                <text x={cx} y={cy - 5}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="7.5" fontWeight="600"
                  fill={labelColor(id)} fontFamily="inherit" letterSpacing="0.04em"
                >
                  {lines[0]}
                </text>
                <text x={cx} y={cy + 6}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="6.5" fontWeight="400"
                  fill={labelColor(id)} fontFamily="inherit" letterSpacing="0.04em"
                  opacity="0.75"
                >
                  {lines[1]}
                </text>
              </>
            )}
          </g>
        ))}

        {/* â”€â”€ Traveling dot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {dotPathId && (
          <circle key={dotKey} r="3.5" fill="#22d3ee" filter="url(#dotGlow)">
            <animateMotion dur="0.65s" fill="freeze" calcMode="spline"
              keyTimes="0;1" keySplines="0.4 0 0.2 1">
              <mpath href={`#tp-${dotPathId}`} />
            </animateMotion>
          </circle>
        )}
      </svg>

      {/* Status label */}
      <div className={styles.label}>
        <span
          className={styles.dot}
          style={{
            background:
              state === 'executing' || state === 'planning' ? '#14b8a6' :
              state === 'synthesizing' ? '#6366f1' :
              state === 'complete'     ? '#0d9488' :
              state === 'error'        ? '#ef4444' :
              '#1e3a4a',
          }}
        />
        {state === 'idle'         ? 'Agent Flow â€” Idle' :
         state === 'planning'     ? 'Dispatching planâ€¦' :
         state === 'executing'    ? 'Agents executingâ€¦' :
         state === 'synthesizing' ? 'Synthesizing resultsâ€¦' :
         state === 'complete'     ? 'Flow complete' :
                                    'Flow error'}
      </div>
    </section>
  );
}
