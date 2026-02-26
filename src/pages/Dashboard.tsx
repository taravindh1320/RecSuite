/* ─────────────────────────────────────────────────────────
 *  Dashboard — Primary layout & orchestration state owner
 *
 *  Owns the centralized ExecutionState and wires lifecycle
 *  callbacks from the orchestrator into all child components.
 *
 *  ┌────────────────────────────────────────────┐
 *  │  Top 65 %                                  │
 *  │  ┌─────────┬─────────────┬────────────┐    │
 *  │  │  Chat   │ AgentGraph  │  ToolLog   │    │
 *  │  └─────────┴─────────────┴────────────┘    │
 *  ├────────────────────────────────────────────┤
 *  │  Bottom 35 %                               │
 *  │  AICoreAnimation (state‑driven)            │
 *  └────────────────────────────────────────────┘
 * ───────────────────────────────────────────────────────── */

import { useState, useCallback } from 'react';
import type {
  ChatMessage,
  AgentNode,
  ToolCall,
  ReportData,
} from '@/types/agent';
import type { ExecutionState } from '@/types/execution';
import { runControlCycle } from '@/services/orchestrator';

import Chat from '@/components/Chat';
import AgentGraph from '@/components/AgentGraph';
import ToolLog from '@/components/ToolLog';
import AgentFlowCanvas from '@/components/AgentFlowCanvas';

import styles from './Dashboard.module.css';

/* ── Helpers ─────────────────────────────────────────────── */

let _msgSeq = 0;
const msgId = () => `msg-${Date.now()}-${++_msgSeq}`;

function sysMsg(content: string): ChatMessage {
  return { id: msgId(), role: 'system', content, timestamp: Date.now() };
}

/* ── Component ───────────────────────────────────────────── */

export default function Dashboard() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nodes, setNodes] = useState<AgentNode[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [executionState, setExecutionState] = useState<ExecutionState>('idle');
  const [agentsToInvoke, setAgentsToInvoke] = useState<string[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const isProcessing = executionState !== 'idle' && executionState !== 'complete' && executionState !== 'error';

  const handleSend = useCallback(async (text: string) => {
    /* 1. Append user message & reset panels */
    const userMsg: ChatMessage = {
      id: msgId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setNodes([]);
    setToolCalls([]);
    setReportData(null);

    try {
      /* 2. Run orchestration control cycle with lifecycle callbacks */
      const result = await runControlCycle(text, {

        onPlanning(profile) {
          setExecutionState('planning');
          setAgentsToInvoke(profile.agentsToInvoke);
          setMessages((prev) => [
            ...prev,
            sysMsg('Analyzing request…'),
          ]);
        },

        onAgentStart(displayName) {
          setExecutionState('executing');
          setMessages((prev) => [
            ...prev,
            sysMsg(`Consulting ${displayName}…`),
          ]);
        },

        onAgentComplete(_displayName, response, node) {
          setNodes((prev) => [...prev, node]);
          setToolCalls((prev) => [...prev, ...response.toolCalls]);
        },

        onSynthesis() {
          setExecutionState('synthesizing');
          setMessages((prev) => [
            ...prev,
            sysMsg('Synthesizing findings…'),
          ]);
        },

        onComplete() {
          setExecutionState('complete');
        },
      });

      /* 3. Capture report data — no assistant bubble appended */
      setReportData(result.reportData);

    } catch {
      setExecutionState('error');
      setMessages((prev) => [
        ...prev,
        sysMsg('An error occurred during analysis. Please try again.'),
      ]);
    }
  }, []);

  return (
    <div className={styles.dashboard}>
      {/* ── Top: orchestration panels (65 %) ────────────── */}
      <div className={styles.top}>
        <div className={styles.chat}>
          <Chat
            messages={messages}
            isProcessing={isProcessing}
            onSend={handleSend}
            reportData={reportData}
          />
        </div>
        <div className={styles.graph}>
          <AgentGraph nodes={nodes} executionState={executionState} />
        </div>
        <div className={styles.log}>
          <ToolLog calls={toolCalls} />
        </div>
      </div>

      {/* ── Bottom: Agent flow canvas ──────────────────── */}
      <div className={styles.bottom}>
        <AgentFlowCanvas state={executionState} nodes={nodes} agentsToInvoke={agentsToInvoke} />
      </div>
    </div>
  );
}
