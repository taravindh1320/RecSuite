/* ─────────────────────────────────────────────────────────
 *  ToolLog — Chronological list of tool calls
 *
 *  Displays user‑facing labels only (agentDisplayName,
 *  operationLabel). Internal identifiers are never rendered.
 * ───────────────────────────────────────────────────────── */

import { useState, useRef, useEffect } from 'react';
import type { ToolCall } from '@/types/agent';
import styles from './ToolLog.module.css';

interface ToolLogProps {
  calls: ToolCall[];
}

const fmtStatus = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1);

export default function ToolLog({ calls }: ToolLogProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isExpanded) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [calls, isExpanded]);

  return (
    <section className={`${styles.container} ${isExpanded ? styles.expanded : styles.collapsed}`}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.title}>Operations</span>
          {calls.length > 0 && (
            <span className={styles.badge}>{calls.length}</span>
          )}
        </div>
        <button
          className={styles.toggle}
          onClick={() => setIsExpanded((v) => !v)}
          title={isExpanded ? 'Hide details' : 'View Technical Details'}
        >
          {isExpanded ? 'Hide' : 'Details'}
          <span className={`${styles.caret} ${isExpanded ? styles.caretUp : ''}`}>
            &rsaquo;
          </span>
        </button>
      </header>

      {isExpanded && (
        <div className={styles.list}>
          {calls.length === 0 && (
            <p className={styles.empty}>No operations recorded.</p>
          )}

          {calls.map((tc) => (
            <div key={tc.id} className={styles.entry}>
              <div className={styles.row}>
                <span className={styles.agent}>{tc.agentDisplayName}</span>
                <span className={styles.badgeStatus} data-status={tc.status}>
                  {fmtStatus(tc.status)}
                </span>
              </div>
              <div className={styles.row}>
                <span className={styles.tool}>{tc.operationLabel}</span>
                {tc.durationMs !== null && (
                  <span className={styles.duration}>{tc.durationMs} ms</span>
                )}
              </div>
              <pre className={styles.payload}>
                {JSON.stringify(tc.output ?? tc.input, null, 2)}
              </pre>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      )}

      {!isExpanded && calls.length > 0 && (
        <div className={styles.miniList}>
          {calls.slice(-4).map((tc) => (
            <div key={tc.id} className={styles.miniEntry}>
              <span className={styles.miniDot} data-status={tc.status} />
              <span className={styles.miniLabel}>{tc.operationLabel}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
