/* 
 *  AgentFlowCanvas  Kinetic orchestration brain
 *
 *  Layout (ViewBox 0 0 660 420):
 *
 *    [ORCHESTRATOR]    [Agent A      ]
 *     large circle     [Agent B      ]    [SYNTHESIS]
 *                      [Agent C      ]        large circle
 *
 *  Multi-dot system: concurrent pulses travel simultaneously.
 *  State drives node glow, ring animations, aura brightness.
 *  */

import { useEffect, useRef, useState } from 'react';
import type { AgentNode } from '@/types/agent';
import type { ExecutionState } from '@/types/execution';
import BrainAura from '@/components/BrainAura';
import styles from './AgentFlowCanvas.module.css';

interface AgentFlowCanvasProps {
  state:           ExecutionState;
  nodes:           AgentNode[];
  agentsToInvoke?: string[];
}

const ORC_CX   = 165;
const ORC_CY   = 210;
const ORC_R    = 56;
const SYN_CX   = 585;
const SYN_CY   = 210;
const SYN_R    = 44;
const AGENT_CX = 400;
const AGENT_W  = 144;
const AGENT_H  = 40;
const VIEWBOX  = '0 0 660 420';

const AGENT_META: Record<string, string[]> = {
  recSignalAgent: ['MONITORING',  'AGENT'],
  recTraceAgent:  ['DEPENDENCY',  'INTELLIGENCE'],
  recCheckAgent:  ['RELEASE',     'VALIDATION'],
};

const DEFAULT_AGENTS = ['recSignalAgent', 'recTraceAgent', 'recCheckAgent'];

function agentIdToKey(id: string): string { return id.replace(/^rec/, '').toLowerCase(); }

function agentYPositions(count: number): number[] {
  if (count === 1) return [210];
  if (count === 2) return [150, 270];
  return [90, 210, 330];
}

interface NodeDef { id: string; lines: string[]; cx: number; cy: number; kind: 'hub' | 'agent'; r?: number; w?: number; h?: number; }
interface Layout   { nodeDefs: NodeDef[]; edgePaths: Record<string, string>; }

function buildLayout(agentIds: string[]): Layout {
  const capped = agentIds.slice(0, 3);
  const ys     = agentYPositions(capped.length);
  const nodeDefs: NodeDef[] = [
    { id: 'orchestrator', kind: 'hub', lines: ['ORCHESTRATOR', 'CONTROL PLANE'], cx: ORC_CX, cy: ORC_CY, r: ORC_R },
  ];
  const edgePaths: Record<string, string> = {};
  const orcRight = ORC_CX + ORC_R; const agentLeft = AGENT_CX - AGENT_W / 2;
  const agentRight = AGENT_CX + AGENT_W / 2; const synLeft = SYN_CX - SYN_R;
  capped.forEach((id, i) => {
    const key = agentIdToKey(id); const cy = ys[i];
    nodeDefs.push({ id: key, kind: 'agent', lines: AGENT_META[id] ?? [id.replace(/^rec/, '').toUpperCase()], cx: AGENT_CX, cy, w: AGENT_W, h: AGENT_H });
    edgePaths[`orc-${key}`]       = `M ${orcRight} ${ORC_CY} C ${orcRight + 70} ${ORC_CY} ${agentLeft - 50} ${cy} ${agentLeft} ${cy}`;
    edgePaths[`${key}-orc`]       = `M ${agentLeft} ${cy} C ${agentLeft - 50} ${cy} ${orcRight + 70} ${ORC_CY} ${orcRight} ${ORC_CY}`;
    edgePaths[`${key}-synthesis`] = `M ${agentRight} ${cy} C ${agentRight + 50} ${cy} ${synLeft - 50} ${SYN_CY} ${synLeft} ${SYN_CY}`;
  });
  nodeDefs.push({ id: 'synthesis', kind: 'hub', lines: ['SYNTHESIS', 'CONVERGENCE'], cx: SYN_CX, cy: SYN_CY, r: SYN_R });
  return { nodeDefs, edgePaths };
}

function matchAgent(label: string, nodeIds: string[]): string {
  const l = label.toLowerCase();
  if (l.includes('monitor') || l.includes('signal')) return nodeIds.find(id => id.startsWith('signal')) ?? '';
  if (l.includes('depend')  || l.includes('trace')  || l.includes('intelligence')) return nodeIds.find(id => id.startsWith('trace')) ?? '';
  if (l.includes('release') || l.includes('valid')  || l.includes('check')) return nodeIds.find(id => id.startsWith('check')) ?? '';
  return '';
}

type NodeStatus   = 'idle' | 'active' | 'complete' | 'error';
type NodeStatuses = Record<string, NodeStatus>;

function deriveStatuses(state: ExecutionState, nodes: AgentNode[], agentNodeIds: string[]): NodeStatuses {
  const s: NodeStatuses = { orchestrator: 'idle', synthesis: 'idle' };
  for (const id of agentNodeIds) s[id] = 'idle';
  if (state === 'idle') return s;
  if (state === 'planning') { s.orchestrator = 'active'; return s; }
  s.orchestrator = 'complete';
  for (const n of nodes) { const id = matchAgent(n.label, agentNodeIds); if (id) s[id] = n.status === 'error' ? 'error' : 'complete'; }
  if (state === 'executing') {
    const done = agentNodeIds.filter(id => s[id] !== 'idle');
    const next = agentNodeIds[done.length];
    if (next) s[next] = 'active';
  }
  if (state === 'synthesizing') s.synthesis = 'active';
  if (state === 'complete')     s.synthesis = 'complete';
  if (state === 'error') { const first = agentNodeIds.find(id => s[id] === 'idle'); if (first) s[first] = 'error'; else s.synthesis = 'error'; }
  return s;
}

interface Dot { key: number; pathId: string; color: string; dur: string; }

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
    const k = pathId.split('-')[0]; const st = statuses[k];
    return (st === 'complete' || st === 'active') ? '#3730a3' : '#0a1224';
  }
  if (pathId.startsWith('orc-')) {
    const k = pathId.split('-')[1]; const st = statuses[k];
    return (st === 'complete' || st === 'active' || st === 'error') ? '#0c5545' : '#0a1224';
  }
  return '#0a1224';
}

export default function AgentFlowCanvas({ state, nodes, agentsToInvoke }: AgentFlowCanvasProps) {
  const resolvedAgents = (agentsToInvoke && agentsToInvoke.length > 0) ? agentsToInvoke : DEFAULT_AGENTS;
  const { nodeDefs, edgePaths } = buildLayout(resolvedAgents);
  const agentNodeIds = resolvedAgents.slice(0, 3).map(agentIdToKey);
  const statuses     = deriveStatuses(state, nodes, agentNodeIds);
  const orcSt = statuses['orchestrator']; const synSt = statuses['synthesis'];

  const [dots, setDots]  = useState<Dot[]>([]);
  const dotKeyRef        = useRef(0);
  const prevNodeCountRef = useRef(0);
  const prevStateRef     = useRef<ExecutionState>('idle');
  const synthFiredRef    = useRef(false);

  function fire(pathId: string, color = '#22d3ee', delay = 0, dur = '0.8s') {
    if (!edgePaths[pathId]) return;
    const go = () => {
      const key = ++dotKeyRef.current;
      setDots(p => [...p, { key, pathId, color, dur }]);
      setTimeout(() => setDots(p => p.filter(d => d.key !== key)), 1300);
    };
    if (delay > 0) setTimeout(go, delay); else go();
  }

  useEffect(() => {
    const prev = prevNodeCountRef.current; const cur = nodes.length;
    if (cur > prev) {
      const newNode = nodes[cur - 1];
      const key     = matchAgent(newNode.label, agentNodeIds);
      if (key) {
        fire(`orc-${key}`,  '#22d3ee', 0,   '0.75s');
        fire(`${key}-orc`,  '#0d9488', 700, '0.75s');
      }
    }
    prevNodeCountRef.current = cur;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  useEffect(() => {
    const prev = prevStateRef.current; prevStateRef.current = state;
    if (state === 'synthesizing' && prev !== 'synthesizing') synthFiredRef.current = false;
    if (state === 'synthesizing' && !synthFiredRef.current) {
      synthFiredRef.current = true;
      const done = agentNodeIds.filter(id => statuses[id] === 'complete' || statuses[id] === 'error');
      done.forEach((id, i) => fire(`${id}-synthesis`, '#818cf8', i * 230, '0.9s'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <section className={`${styles.container} ${styles['s_' + state]}`}>
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
          {Object.entries(edgePaths).map(([id, d]) => (<path key={id} id={`tp-${id}`} d={d} fill="none"/>))}
        </defs>

        {/* Auras */}
        <circle cx={ORC_CX} cy={ORC_CY} r={110} fill={orcSt === 'active' || orcSt === 'complete' ? 'url(#orcAura)' : 'url(#orcAuraIdle)'} opacity={orcSt === 'active' ? 1 : 0.6}/>
        <circle cx={SYN_CX} cy={SYN_CY} r={90}  fill="url(#synAura)" opacity={synSt === 'active' ? 1 : synSt === 'complete' ? 0.5 : 0}/>

        {/* Drawn edges (forward + synthesis, not return paths) */}
        {Object.entries(edgePaths).filter(([id]) => !id.endsWith('-orc')).map(([id, d]) => {
          const agentKey = id.startsWith('orc-') ? id.split('-')[1] : id.split('-')[0];
          const isIdle   = statuses[agentKey] === 'idle';
          return (
            <path key={id} d={d} fill="none"
              stroke={eStroke(id, statuses)} strokeWidth="0.8"
              strokeDasharray={isIdle ? '4 5' : undefined}
              opacity={isIdle ? 0.3 : 0.8}
            />
          );
        })}

        {/* BrainAura crown — renders behind orchestrator node */}
        <BrainAura state={state} cx={ORC_CX} cy={ORC_CY} />

        {/* Orchestrator */}
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

        {/* Agent nodes */}
        {agentNodeIds.map(key => {
          const def = nodeDefs.find(n => n.id === key);
          if (!def || !def.w || !def.h) return null;
          const { cx, cy, w, h, lines } = def; const st = statuses[key];
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

        {/* Synthesis */}
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
        <span className={`${styles.stateDot} ${styles['sdot_' + state]}`}>
          <span className={styles.stateDotCore}/>
        </span>
        <span className={styles.stateLabel}>
          {state === 'idle'         ? 'ORCHESTRATOR READY'    :
           state === 'planning'     ? 'DECOMPOSING INTENT\u2026'    :
           state === 'executing'    ? 'DELEGATING TO AGENTS\u2026'  :
           state === 'synthesizing' ? 'CONVERGING FINDINGS\u2026'   :
           state === 'complete'     ? 'DECISION COMPLETE'     :
                                      'EXECUTION ERROR'}
        </span>
        {state !== 'idle' && (
          <span className={styles.agentCount}>
            {resolvedAgents.length} AGENT{resolvedAgents.length !== 1 ? 'S' : ''}
          </span>
        )}
      </div>
    </section>
  );
}
