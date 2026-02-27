/* 
 *  AgentFlowCanvas  Kinetic orchestration brain
 *
 *  Layout (ViewBox 0 0 660 420):
 *
 *    [ORCHESTRATOR]    [Agent A      ]
 *     large circle     [Agent B      ]    [SYNTHESIS]
 *                      [Agent C      ]        large circle
 *
 *  Dynamic: nodes rendered exclusively from invokedAgents prop.
 *  No hardcoded agent list. activeAgent drives live delegation
 *  pulses; statuses derived purely from prop state.
 */

import { useEffect, useRef, useState } from 'react';
import type { ExecutionState } from '@/types/execution';
import BrainAura from '@/components/BrainAura';
import styles from './AgentFlowCanvas.module.css';

/* -- Props -------------------------------------------------- */

interface AgentFlowCanvasProps {
  executionState: ExecutionState;
  invokedAgents:  string[];       // agentIds from IntentProfile
  activeAgent?:   string;         // agentId currently executing
}

/* -- Constants ---------------------------------------------- */

const ORC_CX   = 165;
const ORC_CY   = 210;
const ORC_R    = 56;
const SYN_CX   = 585;
const SYN_CY   = 210;
const SYN_R    = 44;
const AGENT_CX = 400;
const AGENT_W  = 144;
const AGENT_H  = 40;
const MAX_AGENTS = 4;
const VIEWBOX  = '0 0 660 420';

/* -- Agent display metadata ---------------------------------- */

const AGENT_META: Record<string, [string, string]> = {
  recSignalAgent:  ['MONITORING',    'AGENT'],
  recTraceAgent:   ['DEPENDENCY',    'INTELLIGENCE'],
  recCheckAgent:   ['RELEASE',       'VALIDATION'],
  recServerAgent:  ['SERVER HEALTH', 'AGENT'],
};

/** Fallback label pair for unregistered agents */
function agentLines(id: string): [string, string] {
  if (AGENT_META[id]) return AGENT_META[id];
  const base = id.replace(/^rec/, '').replace(/Agent$/, '').replace(/([A-Z])/g, ' $1').trim().toUpperCase();
  return [base, 'AGENT'];
}

/** Internal key: strip rec prefix, lowercase */
function agentKey(id: string): string { return id.replace(/^rec/, '').toLowerCase(); }

/* -- Layout builder ------------------------------------------- */

function agentYPositions(count: number): number[] {
  if (count === 1) return [210];
  if (count === 2) return [150, 270];
  if (count === 3) return [90, 210, 330];
  return [70, 160, 260, 350];
}

interface NodeDef { id: string; lines: [string, string]; cx: number; cy: number; kind: 'hub' | 'agent'; r?: number; w?: number; h?: number; }
interface Layout   { nodeDefs: NodeDef[]; edgePaths: Record<string, string>; }

function buildLayout(agentIds: string[]): Layout {
  const capped     = agentIds.slice(0, MAX_AGENTS);
  const ys         = agentYPositions(capped.length);
  const nodeDefs: NodeDef[] = [
    { id: 'orchestrator', kind: 'hub', lines: ['ORCHESTRATOR', 'CONTROL PLANE'], cx: ORC_CX, cy: ORC_CY, r: ORC_R },
  ];
  const edgePaths: Record<string, string> = {};
  const orcRight  = ORC_CX + ORC_R;
  const agentLeft = AGENT_CX - AGENT_W / 2;
  const agentRight = AGENT_CX + AGENT_W / 2;
  const synLeft   = SYN_CX - SYN_R;

  capped.forEach((id, i) => {
    const key = agentKey(id);
    const cy  = ys[i];
    nodeDefs.push({ id: key, kind: 'agent', lines: agentLines(id), cx: AGENT_CX, cy, w: AGENT_W, h: AGENT_H });
    edgePaths[`orc-${key}`]       = `M ${orcRight} ${ORC_CY} C ${orcRight + 70} ${ORC_CY} ${agentLeft - 50} ${cy} ${agentLeft} ${cy}`;
    edgePaths[`${key}-orc`]       = `M ${agentLeft} ${cy} C ${agentLeft - 50} ${cy} ${orcRight + 70} ${ORC_CY} ${orcRight} ${ORC_CY}`;
    edgePaths[`${key}-synthesis`] = `M ${agentRight} ${cy} C ${agentRight + 50} ${cy} ${synLeft - 50} ${SYN_CY} ${synLeft} ${SYN_CY}`;
  });
  nodeDefs.push({ id: 'synthesis', kind: 'hub', lines: ['SYNTHESIS', 'CONVERGENCE'], cx: SYN_CX, cy: SYN_CY, r: SYN_R });
  return { nodeDefs, edgePaths };
}

/* -- Status derivation --------------------------------------- */

type NodeStatus   = 'idle' | 'active' | 'complete' | 'error';
type NodeStatuses = Record<string, NodeStatus>;

/**
 * Pure derivation — no AgentNode array needed.
 * Status is computed from invokedAgents order + activeAgent + executionState.
 *
 * Agents before activeAgent in the list  ? complete
 * activeAgent                            ? active (or error on state=error)
 * Agents after activeAgent               ? idle
 * When synthesizing/complete             ? all agents complete
 */
function deriveStatuses(
  executionState: ExecutionState,
  agentNodeIds: string[],
  activeAgentKey: string,
): NodeStatuses {
  const s: NodeStatuses = { orchestrator: 'idle', synthesis: 'idle' };
  for (const id of agentNodeIds) s[id] = 'idle';

  if (executionState === 'idle') return s;

  if (executionState === 'planning') {
    s.orchestrator = 'active';
    return s;
  }

  s.orchestrator = 'complete';

  const isTerminal = executionState === 'synthesizing' || executionState === 'complete';
  const activeIdx  = activeAgentKey ? agentNodeIds.indexOf(activeAgentKey) : -1;

  for (let i = 0; i < agentNodeIds.length; i++) {
    const id = agentNodeIds[i];
    if (isTerminal) {
      s[id] = 'complete';
    } else if (activeIdx === -1) {
      // executing but no active agent yet (between agents)
      s[id] = 'idle';
    } else if (i < activeIdx) {
      s[id] = 'complete';
    } else if (i === activeIdx) {
      s[id] = executionState === 'error' ? 'error' : 'active';
    }
    // i > activeIdx ? stays idle
  }

  if (executionState === 'synthesizing') s.synthesis = 'active';
  if (executionState === 'complete')     s.synthesis = 'complete';
  if (executionState === 'error') {
    if (activeAgentKey && agentNodeIds.includes(activeAgentKey)) {
      s[activeAgentKey] = 'error';
    } else {
      s.synthesis = 'error';
    }
  }
  return s;
}

/* -- Colour helpers ------------------------------------------- */

function nStroke(id: string, st: NodeStatus): string {
  if (st === 'error')    return '#ef4444';
  if (st === 'active')   return id === 'synthesis' ? '#6366f1' : '#14b8a6';
  if (st === 'complete') return id === 'synthesis' ? '#4f46e5' : '#0d9488';
  return '#142030';
}
function nFill(id: string, st: NodeStatus): string {
  if (st === 'error')    return 'rgba(239,68,68,0.13)';
  if (st === 'active')   return id === 'synthesis' ? 'rgba(99,102,241,0.13)' : 'rgba(20,184,166,0.12)';
  if (st === 'complete') return id === 'synthesis' ? 'rgba(79,70,229,0.07)'  : 'rgba(13,148,136,0.07)';
  return 'rgba(6,14,28,0.92)';
}
function nFilter(id: string, st: NodeStatus): string {
  if (st === 'error')  return 'url(#glowRed)';
  if (st !== 'active') return 'none';
  if (id === 'orchestrator') return 'url(#glowCyanXL)';
  if (id === 'synthesis')    return 'url(#glowIndigo)';
  return 'url(#glowCyan)';
}
function nLabel(id: string, st: NodeStatus): string {
  if (st === 'error')    return '#fca5a5';
  if (st === 'active')   return id === 'synthesis' ? '#a5b4fc' : '#5eead4';
  if (st === 'complete') return id === 'synthesis' ? '#818cf8' : '#7dbdb4';
  return '#1e3550';
}
function eStroke(pathId: string, statuses: NodeStatuses): string {
  if (pathId.endsWith('-synthesis')) {
    const k = pathId.split('-')[0];
    const st = statuses[k];
    return (st === 'complete' || st === 'active') ? '#3730a3' : '#0a1224';
  }
  if (pathId.startsWith('orc-')) {
    const k = pathId.split('-')[1];
    const st = statuses[k];
    return (st === 'complete' || st === 'active' || st === 'error') ? '#0c5545' : '#0a1224';
  }
  return '#0a1224';
}

/* -- Traveling dot type --------------------------------------- */

interface Dot { key: number; pathId: string; color: string; dur: string; }

/* -- Component ------------------------------------------------- */

export default function AgentFlowCanvas({ executionState, invokedAgents, activeAgent }: AgentFlowCanvasProps) {
  const resolvedAgents = invokedAgents.length > 0 ? invokedAgents : [];
  const { nodeDefs, edgePaths } = buildLayout(resolvedAgents);
  const agentNodeIds    = resolvedAgents.slice(0, MAX_AGENTS).map(agentKey);
  const activeAgentKey  = activeAgent ? agentKey(activeAgent) : '';
  const statuses        = deriveStatuses(executionState, agentNodeIds, activeAgentKey);
  const orcSt  = statuses['orchestrator'];
  const synSt  = statuses['synthesis'];

  const [dots, setDots]   = useState<Dot[]>([]);
  const dotKeyRef         = useRef(0);
  const prevActiveRef     = useRef('');
  const prevStateRef      = useRef<ExecutionState>('idle');
  const synthFiredRef     = useRef(false);

  function fire(pathId: string, color = '#22d3ee', delay = 0, dur = '0.8s') {
    if (!edgePaths[pathId]) return;
    const go = () => {
      const key = ++dotKeyRef.current;
      setDots(p => [...p, { key, pathId, color, dur }]);
      setTimeout(() => setDots(p => p.filter(d => d.key !== key)), 1400);
    };
    if (delay > 0) setTimeout(go, delay); else go();
  }

  // Delegation pulse: fires whenever a new agent becomes active
  useEffect(() => {
    if (!activeAgent || !activeAgentKey) return;
    if (prevActiveRef.current === activeAgentKey) return;
    prevActiveRef.current = activeAgentKey;
    fire(`orc-${activeAgentKey}`,  '#22d3ee', 0,   '0.75s');
    fire(`${activeAgentKey}-orc`,  '#0d9488', 720, '0.75s');
  // edgePaths is derived from resolvedAgents; safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAgent]);

  // Synthesis convergence pulses: all completed agents ? synthesis
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = executionState;
    if (executionState === 'synthesizing' && prev !== 'synthesizing') {
      synthFiredRef.current = false;
    }
    if (executionState === 'synthesizing' && !synthFiredRef.current) {
      synthFiredRef.current = true;
      agentNodeIds.forEach((id, i) =>
        fire(`${id}-synthesis`, '#818cf8', i * 230, '0.9s'),
      );
    }
    if (executionState === 'idle') {
      prevActiveRef.current = '';
      synthFiredRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionState]);

  return (
    <section className={`${styles.container} ${styles['s_' + executionState]}`}>
      <div className={styles.overlay} />
      <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid meet" className={styles.svg}>
        <defs>
          <filter id="glowCyanXL" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glowCyan"   x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glowIndigo" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glowRed"    x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="dotGlow"  x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <radialGradient id="orcAura"     cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#14b8a6" stopOpacity="0.18"/><stop offset="100%" stopColor="#14b8a6" stopOpacity="0"/></radialGradient>
          <radialGradient id="orcAuraIdle" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#14b8a6" stopOpacity="0.04"/><stop offset="100%" stopColor="#14b8a6" stopOpacity="0"/></radialGradient>
          <radialGradient id="synAura"     cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#6366f1" stopOpacity="0.20"/><stop offset="100%" stopColor="#6366f1" stopOpacity="0"/></radialGradient>
          {Object.entries(edgePaths).map(([id, d]) => (
            <path key={id} id={`tp-${id}`} d={d} fill="none"/>
          ))}
        </defs>

        {/* Auras */}
        <circle cx={ORC_CX} cy={ORC_CY} r={110} fill={orcSt === 'active' || orcSt === 'complete' ? 'url(#orcAura)' : 'url(#orcAuraIdle)'} opacity={orcSt === 'active' ? 1 : 0.6}/>
        <circle cx={SYN_CX} cy={SYN_CY} r={90}  fill="url(#synAura)" opacity={synSt === 'active' ? 1 : synSt === 'complete' ? 0.5 : 0}/>

        {/* Drawn edges — forward + synthesis only (not return paths) */}
        {Object.entries(edgePaths)
          .filter(([id]) => !id.endsWith('-orc'))
          .map(([id, d]) => {
            const agentK = id.startsWith('orc-') ? id.split('-')[1] : id.split('-')[0];
            const isIdle = statuses[agentK] === 'idle';
            return (
              <path key={id} d={d} fill="none"
                stroke={eStroke(id, statuses)} strokeWidth="0.8"
                strokeDasharray={isIdle ? '4 5' : undefined}
                opacity={isIdle ? 0.3 : 0.8}
              />
            );
          })}

        {/* BrainAura crown */}
        <BrainAura state={executionState} cx={ORC_CX} cy={ORC_CY} />

        {/* Orchestrator hub */}
        <g>
          {orcSt === 'active' && (<>
            <circle cx={ORC_CX} cy={ORC_CY} fill="none" stroke="#14b8a6" strokeWidth="1.5">
              <animate attributeName="r" from={ORC_R+6} to={ORC_R+42} dur="1.4s" repeatCount="indefinite"/>
              <animate attributeName="opacity" from="0.75" to="0" dur="1.4s" repeatCount="indefinite"/>
            </circle>
            <circle cx={ORC_CX} cy={ORC_CY} fill="none" stroke="#14b8a6" strokeWidth="0.6">
              <animate attributeName="r" from={ORC_R+16} to={ORC_R+62} dur="1.4s" begin="0.45s" repeatCount="indefinite"/>
              <animate attributeName="opacity" from="0.35" to="0" dur="1.4s" begin="0.45s" repeatCount="indefinite"/>
            </circle>
          </>)}
          <circle cx={ORC_CX} cy={ORC_CY} r={ORC_R+8} fill="none"
            stroke={orcSt === 'idle' ? '#0c1e2e' : orcSt === 'error' ? '#7f1d1d' : '#0d4a3a'}
            strokeWidth="0.5" strokeDasharray={orcSt === 'idle' ? '4 7' : undefined} opacity="0.5"/>
          <circle cx={ORC_CX} cy={ORC_CY} r={ORC_R}
            fill={nFill('orchestrator', orcSt)} stroke={nStroke('orchestrator', orcSt)}
            strokeWidth="1.5" filter={nFilter('orchestrator', orcSt)}/>
          <circle cx={ORC_CX} cy={ORC_CY} r={ORC_R-10} fill="none"
            stroke={nStroke('orchestrator', orcSt)} strokeWidth="0.4" opacity="0.28"/>
          <text x={ORC_CX} y={ORC_CY-7} textAnchor="middle" dominantBaseline="middle"
            fontSize="7.5" fontWeight="700" letterSpacing="0.1em"
            fill={nLabel('orchestrator', orcSt)} fontFamily="inherit">ORCHESTRATOR</text>
          <text x={ORC_CX} y={ORC_CY+8} textAnchor="middle" dominantBaseline="middle"
            fontSize="5.5" fontWeight="400" letterSpacing="0.08em"
            fill={nLabel('orchestrator', orcSt)} fontFamily="inherit" opacity="0.55">CONTROL PLANE</text>
        </g>

        {/* Dynamic agent nodes — only rendered agents, no ghosts */}
        {agentNodeIds.map(key => {
          const def = nodeDefs.find(n => n.id === key);
          if (!def || !def.w || !def.h) return null;
          const { cx, cy, w, h, lines } = def;
          const st = statuses[key];
          return (
            <g key={key}>
              {st === 'active' && (
                <rect x={cx-w/2-3} y={cy-h/2} width="3" height={h} rx="1.5" fill="#14b8a6">
                  <animate attributeName="opacity" values="0.3;1;0.3" dur="0.65s" repeatCount="indefinite"/>
                </rect>
              )}
              <rect x={cx-w/2} y={cy-h/2} width={w} height={h} rx="9"
                fill={nFill(key, st)} stroke={nStroke(key, st)}
                strokeWidth="1" filter={nFilter(key, st)}/>
              <text x={cx} y={cy-6} textAnchor="middle" dominantBaseline="middle"
                fontSize="7" fontWeight="700" letterSpacing="0.09em"
                fill={nLabel(key, st)} fontFamily="inherit">{lines[0]}</text>
              <text x={cx} y={cy+6} textAnchor="middle" dominantBaseline="middle"
                fontSize="5.5" fontWeight="400" letterSpacing="0.07em"
                fill={nLabel(key, st)} fontFamily="inherit" opacity="0.62">{lines[1]}</text>
            </g>
          );
        })}

        {/* Synthesis hub */}
        <g>
          {synSt === 'active' && (<>
            <circle cx={SYN_CX} cy={SYN_CY} fill="none" stroke="#6366f1" strokeWidth="2">
              <animate attributeName="r" from={SYN_R+4} to={SYN_R+40} dur="1.1s" repeatCount="indefinite"/>
              <animate attributeName="opacity" from="0.85" to="0" dur="1.1s" repeatCount="indefinite"/>
            </circle>
            <circle cx={SYN_CX} cy={SYN_CY} fill="none" stroke="#818cf8" strokeWidth="0.7">
              <animate attributeName="r" from={SYN_R+12} to={SYN_R+62} dur="1.1s" begin="0.35s" repeatCount="indefinite"/>
              <animate attributeName="opacity" from="0.4" to="0" dur="1.1s" begin="0.35s" repeatCount="indefinite"/>
            </circle>
          </>)}
          <circle cx={SYN_CX} cy={SYN_CY} r={SYN_R+7} fill="none"
            stroke={synSt === 'idle' ? '#0c1628' : synSt === 'complete' ? '#2a1e6a' : '#1a1e5a'}
            strokeWidth="0.5" strokeDasharray={synSt === 'idle' ? '4 7' : undefined} opacity="0.5"/>
          <circle cx={SYN_CX} cy={SYN_CY} r={SYN_R}
            fill={nFill('synthesis', synSt)} stroke={nStroke('synthesis', synSt)}
            strokeWidth="1.5" filter={nFilter('synthesis', synSt)}/>
          <circle cx={SYN_CX} cy={SYN_CY} r={SYN_R-9} fill="none"
            stroke={nStroke('synthesis', synSt)} strokeWidth="0.4" opacity="0.25"/>
          <text x={SYN_CX} y={SYN_CY-7} textAnchor="middle" dominantBaseline="middle"
            fontSize="7.5" fontWeight="700" letterSpacing="0.1em"
            fill={nLabel('synthesis', synSt)} fontFamily="inherit">SYNTHESIS</text>
          <text x={SYN_CX} y={SYN_CY+8} textAnchor="middle" dominantBaseline="middle"
            fontSize="5.5" fontWeight="400" letterSpacing="0.08em"
            fill={nLabel('synthesis', synSt)} fontFamily="inherit" opacity="0.55">CONVERGENCE</text>
        </g>

        {/* Traveling dots */}
        {dots.map(({ key, pathId, color, dur }) => (
          <circle key={key} r="5" fill={color} filter="url(#dotGlow)">
            <animateMotion dur={dur} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1">
              <mpath href={`#tp-${pathId}`}/>
            </animateMotion>
          </circle>
        ))}
      </svg>

      {/* State bar */}
      <div className={styles.stateBar}>
        <span className={`${styles.stateDot} ${styles['sdot_' + executionState]}`}>
          <span className={styles.stateDotCore}/>
        </span>
        <span className={styles.stateLabel}>
          {executionState === 'idle'         ? 'ORCHESTRATOR READY'          :
           executionState === 'planning'     ? 'DECOMPOSING INTENT\u2026'    :
           executionState === 'executing'    ? 'DELEGATING TO AGENTS\u2026'  :
           executionState === 'synthesizing' ? 'CONVERGING FINDINGS\u2026'   :
           executionState === 'complete'     ? 'DECISION COMPLETE'           :
                                               'EXECUTION ERROR'}
        </span>
        {executionState !== 'idle' && resolvedAgents.length > 0 && (
          <span className={styles.agentCount}>
            {resolvedAgents.length} AGENT{resolvedAgents.length !== 1 ? 'S' : ''}
          </span>
        )}
      </div>
    </section>
  );
}
