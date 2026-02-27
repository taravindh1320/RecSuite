/* ─────────────────────────────────────────────────────────
 *  OperationsDrawer — Collapsible right-edge overlay
 *
 *  Slim vertical trigger tab on right edge of viewport.
 *  Clicking slides in a drawer panel from right.
 *  Backdrop click or × closes it.
 * ───────────────────────────────────────────────────────── */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ToolCall } from '@/types/agent';
import type { ExecutionState } from '@/types/execution';
import styles from './OperationsDrawer.module.css';

/* ── Helpers ─────────────────────────────────────────────── */

const fmtStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/* ── Props ───────────────────────────────────────────────── */

interface OperationsDrawerProps {
  calls:          ToolCall[];
  executionState: ExecutionState;
}

/* ── Component ───────────────────────────────────────────── */

export default function OperationsDrawer({ calls, executionState }: OperationsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef           = useRef<HTMLDivElement>(null);
  const bottomRef           = useRef<HTMLDivElement>(null);

  const open  = useCallback(() => setIsOpen(true),  []);
  const close = useCallback(() => setIsOpen(false), []);

  /* Auto-scroll to bottom on new calls when open */
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [calls.length, isOpen]);

  /* Keyboard close */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  const activityPulse = (executionState === 'executing' || executionState === 'synthesizing') && calls.length > 0;

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────── */}
      {isOpen && (
        <div
          className={styles.backdrop}
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* ── Trigger tab ──────────────────────────────── */}
      <button
        className={`${styles.tab} ${isOpen ? styles.tabHidden : ''}`}
        onClick={open}
        aria-label="Open operations log"
        title="Operations Log"
      >
        {/* Activity count badge */}
        {calls.length > 0 && (
          <span className={`${styles.tabBadge} ${activityPulse ? styles.tabBadgePulse : ''}`}>
            {calls.length}
          </span>
        )}
        <span className={styles.tabLabel}>OPS</span>
        <span className={styles.tabCaret}>›</span>
      </button>

      {/* ── Drawer panel ─────────────────────────────── */}
      <div
        ref={drawerRef}
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-label="Operations log"
      >
        {/* Header */}
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitleRow}>
            <span className={styles.drawerTitle}>OPERATIONS LOG</span>
            {calls.length > 0 && (
              <span className={styles.drawerBadge}>{calls.length}</span>
            )}
          </div>
          <button
            className={styles.closeBtn}
            onClick={close}
            aria-label="Close operations log"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className={styles.drawerContent}>
          {calls.length === 0 ? (
            <p className={styles.empty}>No operations recorded.</p>
          ) : (
            calls.map((tc) => (
              <div key={tc.id} className={styles.entry}>
                <div className={styles.entryHeader}>
                  <span className={styles.agent}>{tc.agentDisplayName}</span>
                  <span className={styles.ts}>{fmtTs(tc.startedAt)}</span>
                </div>
                <div className={styles.entryMeta}>
                  <span className={styles.tool}>{tc.operationLabel}</span>
                  <span
                    className={`${styles.status} ${styles['status_' + tc.status]}`}
                  >
                    {fmtStatus(tc.status)}
                  </span>
                  {tc.durationMs !== null && (
                    <span className={styles.duration}>{tc.durationMs}ms</span>
                  )}
                </div>
                {tc.output && (
                  <pre className={styles.payload}>
                    {JSON.stringify(tc.output, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  );
}
