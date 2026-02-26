/* ─────────────────────────────────────────────────────────
 *  Chat — Conversation panel with input bar
 *
 *  Shows user messages, system status updates, and
 *  professional assistant responses. Never exposes internal
 *  function names or raw agent identifiers.
 * ───────────────────────────────────────────────────────── */

import { useState, useRef, useEffect, Fragment, type FormEvent } from 'react';
import type { ChatMessage, ReportData } from '@/types/agent';
import ReportPanel from '@/components/ReportPanel';
import styles from './Chat.module.css';

interface ChatProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  onSend: (text: string) => void;
  reportData?: ReportData | null;
}

export default function Chat({ messages, isProcessing, onSend, reportData }: ChatProps) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  /* Auto‑scroll to latest message */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isProcessing) return;
    onSend(trimmed);
    setDraft('');
  };

  /* Group consecutive system messages so we can add a divider
     before the first non-system message that follows them */
  const renderedMessages = messages.map((m, idx) => {
    const isFirst = idx === 0;
    const prevRole = isFirst ? null : messages[idx - 1].role;
    // Insert a step-divider after a run of system messages when
    // the conversation transitions back to user/assistant
    const showDivider =
      !isFirst && prevRole === 'system' && m.role !== 'system';
    return { msg: m, showDivider };
  });

  return (
    <section className={styles.container}>
      <header className={styles.header}>Conversation</header>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <p className={styles.empty}>
            Ask a question to begin analysis.
          </p>
        )}
        {renderedMessages.map(({ msg: m, showDivider }) => (
          <Fragment key={m.id}>
            {showDivider && (
              <div className={styles.stepDivider} />
            )}
            <div
              className={`${styles.bubble} ${styles[m.role]}`}
            >
              {m.role !== 'system' && (
                <span className={styles.role}>
                  {m.role === 'user' ? 'You' : 'RecSuite'}
                </span>
              )}
              <p className={styles.content}>{m.content}</p>
            </div>
          </Fragment>
        ))}
        {reportData && (
          <div className={styles.reportWrapper}>
            <ReportPanel report={reportData} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form className={styles.inputBar} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="text"
          placeholder={isProcessing ? 'Processing…' : 'Ask a question…'}
          value={draft}
          disabled={isProcessing}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className={styles.send}
          type="submit"
          disabled={isProcessing || draft.trim().length === 0}
        >
          {isProcessing ? '⏳' : '→'}
        </button>
      </form>
    </section>
  );
}
