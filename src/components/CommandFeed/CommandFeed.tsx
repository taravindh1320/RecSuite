/* ─────────────────────────────────────────────────────────
 *  CommandFeed — Execution console panel
 *
 *  Replaces the chat metaphor entirely.
 *
 *  Structure:
 *    ┌─ COMMAND CONSOLE header ───────────── [STATE] ┐
 *    │  › <current command text>                      │
 *    ├───────────────────────────────────────────────-┤
 *    │  [HH:MM:SS] Decomposing intent...              │
 *    │  [HH:MM:SS] Delegating to Monitoring Agent     │
 *    │  [HH:MM:SS] Synthesizing findings...           │
 *    │                                                │
 *    │  ── AI DECISION REPORT ──────────────────────  │
 *    ├────────────────────────────────────────────────┤
 *    │  › input bar                          [RUN]    │
 *    └────────────────────────────────────────────────┘
 * ───────────────────────────────────────────────────────── */

import { useRef, useEffect, useState, useCallback, type FormEvent } from 'react';
import type { ReportData } from '@/types/agent';
import type { ExecutionState } from '@/types/execution';
import ReportPanel from '@/components/ReportPanel';
import styles from './CommandFeed.module.css';

/* ── Feed entry type (exported for Dashboard) ─────────────── */

export interface FeedEntry {
  id:   string;
  ts:   number;
  text: string;
  type: 'planning' | 'agent' | 'synthesis' | 'error' | 'complete';
}

/* ── Props ───────────────────────────────────────────────── */

interface CommandFeedProps {
  command:        string;
  feedEntries:    FeedEntry[];
  reportData:     ReportData | null;
  isProcessing:   boolean;
  executionState: ExecutionState;
  onSend:         (text: string) => void;
}

/* ── Timestamp formatter ─────────────────────────────────── */

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/* ── State badge label ───────────────────────────────────── */

const STATE_LABELS: Record<ExecutionState, string> = {
  idle:         'STANDBY',
  planning:     'PLANNING',
  executing:    'EXECUTING',
  synthesizing: 'SYNTHESIZING',
  complete:     'COMPLETE',
  error:        'ERROR',
};

/* ── Component ───────────────────────────────────────────── */

export default function CommandFeed({
  command,
  feedEntries,
  reportData,
  isProcessing,
  executionState,
  onSend,
}: CommandFeedProps) {
  const [draft, setDraft]         = useState('');
  const [submitGlow, setSubmitGlow] = useState(false);
  const bottomRef                  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feedEntries.length, reportData]);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isProcessing) return;
    onSend(trimmed);
    setDraft('');
    setSubmitGlow(true);
    setTimeout(() => setSubmitGlow(false), 800);
  }, [draft, isProcessing, onSend]);

  return (
    <section className={`${styles.container} ${styles[executionState] ?? ''}`}>

      {/* ── Header ───────────────────────────────── */}
      <div className={styles.header}>
        <span className={styles.headerLabel}>COMMAND CONSOLE</span>
        <span className={`${styles.stateBadge} ${styles['badge_' + executionState]}`}>
          {STATE_LABELS[executionState]}
        </span>
      </div>

      {/* ── Active command ───────────────────────── */}
      {command ? (
        <div className={styles.commandRow}>
          <span className={styles.prompt}>›</span>
          <span className={styles.commandText}>{command}</span>
        </div>
      ) : (
        <div className={styles.commandRowEmpty}>
          No active command
        </div>
      )}

      {/* ── Execution feed ───────────────────────── */}
      <div className={styles.feed}>

        {feedEntries.length === 0 && executionState === 'idle' && (
          <p className={styles.emptyState}>
            Awaiting command input.
          </p>
        )}

        {feedEntries.map((entry) => (
          <div
            key={entry.id}
            className={`${styles.entry} ${styles['entry_' + entry.type]}`}
          >
            <span className={styles.entryTs}>[{fmtTs(entry.ts)}]</span>
            <span className={styles.entryText}>{entry.text}</span>
          </div>
        ))}

        {/* ── Decision report ──────────────────── */}
        {reportData && (
          <div className={styles.reportWrapper}>
            <ReportPanel report={reportData} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ────────────────────────────── */}
      <form className={`${styles.inputBar} ${submitGlow ? styles.inputBarGlow : ''}`} onSubmit={handleSubmit}>
        <span className={styles.inputPrompt}>›</span>
        <input
          className={styles.input}
          type="text"
          placeholder={isProcessing ? 'Processing…' : 'Enter command…'}
          value={draft}
          disabled={isProcessing}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          className={styles.runBtn}
          type="submit"
          disabled={isProcessing || draft.trim().length === 0}
        >
          {isProcessing ? '●●●' : 'RUN'}
        </button>
      </form>
    </section>
  );
}
