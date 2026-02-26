/* ─────────────────────────────────────────────────────────
 *  AgentGraph — Visual pipeline of execution lifecycle
 *
 *  Renders the full control cycle as a vertical pipeline:
 *    Planning → Agent nodes → Synthesis → Complete
 *
 *  Transitions are driven by ExecutionState + AgentNode[].
 * ───────────────────────────────────────────────────────── */

import type { AgentNode } from '@/types/agent';
import type { ExecutionState } from '@/types/execution';
import styles from './AgentGraph.module.css';

interface AgentGraphProps {
  nodes: AgentNode[];
  executionState: ExecutionState;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#475569',
  running: '#facc15',
  success: '#0d9488',
  error: '#ef4444',
};

/** Map lifecycle phases to display colour */
const PHASE_COLORS: Record<string, string> = {
  idle: '#475569',
  active: '#0d9488',
  waiting: '#facc15',
};

interface PhaseNodeDef {
  id: string;
  label: string;
  color: string;
  status: string;
}

export default function AgentGraph({ nodes, executionState }: AgentGraphProps) {
  /* Build the full pipeline: lifecycle phases + dynamic agent nodes */
  const pipeline: PhaseNodeDef[] = [];

  // --- Planning node ---
  const planningDone =
    executionState !== 'idle' && executionState !== 'planning';
  pipeline.push({
    id: '_planning',
    label: 'Planning',
    color:
      executionState === 'planning'
        ? PHASE_COLORS.waiting
        : planningDone
          ? PHASE_COLORS.active
          : PHASE_COLORS.idle,
    status:
      executionState === 'planning'
        ? 'running'
        : planningDone
          ? 'complete'
          : 'pending',
  });

  // --- Agent nodes ---
  for (const node of nodes) {
    pipeline.push({
      id: node.id,
      label: node.label,
      color: STATUS_COLORS[node.status] ?? '#475569',
      status: node.status,
    });
  }

  // --- Synthesis node ---
  const synthDone =
    executionState === 'complete' || executionState === 'error';
  const synthActive = executionState === 'synthesizing';
  if (synthActive || synthDone) {
    pipeline.push({
      id: '_synthesis',
      label: 'Synthesis',
      color: synthActive
        ? PHASE_COLORS.waiting
        : synthDone
          ? PHASE_COLORS.active
          : PHASE_COLORS.idle,
      status: synthActive ? 'running' : synthDone ? 'complete' : 'pending',
    });
  }

  // --- Complete node ---
  if (executionState === 'complete') {
    pipeline.push({
      id: '_complete',
      label: 'Complete',
      color: PHASE_COLORS.active,
      status: 'complete',
    });
  }

  // --- Error node ---
  if (executionState === 'error') {
    pipeline.push({
      id: '_error',
      label: 'Error',
      color: STATUS_COLORS.error,
      status: 'error',
    });
  }

  const isActive = (item: PhaseNodeDef) =>
    item.status === 'running';
  const isDone = (item: PhaseNodeDef) =>
    item.status === 'complete' || item.status === 'success';
  const isError = (item: PhaseNodeDef) =>
    item.status === 'error';

  return (
    <section className={styles.container}>
      <header className={styles.header}>Execution Timeline</header>

      <div className={styles.stepper}>
        {executionState === 'idle' && pipeline.length <= 1 && (
          <p className={styles.empty}>Awaiting input…</p>
        )}

        {(executionState !== 'idle' || nodes.length > 0) &&
          pipeline.map((item, idx) => (
            <div
              key={item.id}
              className={[
                styles.step,
                isActive(item)  ? styles.stepActive  : '',
                isDone(item)    ? styles.stepDone    : '',
                isError(item)   ? styles.stepError   : '',
                idx === 0       ? styles.stepFirst   : '',
                idx === pipeline.length - 1 ? styles.stepLast : '',
              ].join(' ')}
            >
              {/* Vertical track line */}
              {idx < pipeline.length - 1 && (
                <span
                  className={[
                    styles.track,
                    isDone(item) ? styles.trackDone : '',
                    isActive(item) ? styles.trackActive : '',
                  ].join(' ')}
                />
              )}

              {/* Circle indicator */}
              <span
                className={[
                  styles.circle,
                  isActive(item) ? styles.circleActive  : '',
                  isDone(item)   ? styles.circleDone    : '',
                  isError(item)  ? styles.circleError   : '',
                ].join(' ')}
              >
                {isDone(item) && !isError(item) && (
                  <svg viewBox="0 0 10 10" className={styles.checkIcon}>
                    <polyline points="2,5 4.5,7.5 8,2.5" />
                  </svg>
                )}
                {isError(item) && (
                  <svg viewBox="0 0 10 10" className={styles.errorIcon}>
                    <line x1="2" y1="2" x2="8" y2="8" />
                    <line x1="8" y1="2" x2="2" y2="8" />
                  </svg>
                )}
                {isActive(item) && (
                  <span className={styles.circleRing} />
                )}
              </span>

              {/* Step metadata */}
              <div className={styles.meta}>
                <span className={styles.stepLabel}>{item.label}</span>
                {item.status !== 'pending' && (
                  <span className={styles.stepStatus}>{item.status}</span>
                )}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
