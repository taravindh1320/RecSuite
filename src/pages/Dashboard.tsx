/* ─────────────────────────────────────────────────────────
 *  Dashboard — Kinetic AI Brain Interface
 *  Layout: 30 % CommandFeed │ 70 % Brain/Flow
 *  Operations log: collapsible right-edge overlay drawer
 * ───────────────────────────────────────────────────────── */

import { useState, useCallback } from 'react';
import type {
  AgentNode,
  ToolCall,
  ReportData,
} from '@/types/agent';
import type { ExecutionState } from '@/types/execution';
import { runControlCycle } from '@/services/orchestrator';

import CommandFeed, { type FeedEntry } from '@/components/CommandFeed';
import OperationsDrawer from '@/components/OperationsDrawer';
import AgentFlowCanvas from '@/components/AgentFlowCanvas';

import styles from './Dashboard.module.css';

/* ── Feed entry id helper ────────────────────────────────── */

let _feSeq = 0;
const feId = () => `fe-${Date.now()}-${++_feSeq}`;

/* ── Component ───────────────────────────────────────────── */

export default function Dashboard() {
  const [command,       setCommand]       = useState('');
  const [feedEntries,   setFeedEntries]   = useState<FeedEntry[]>([]);
  const [nodes,         setNodes]         = useState<AgentNode[]>([]);
  const [toolCalls,     setToolCalls]     = useState<ToolCall[]>([]);
  const [executionState, setExecutionState] = useState<ExecutionState>('idle');
  const [agentsToInvoke, setAgentsToInvoke] = useState<string[]>([]);
  const [reportData,    setReportData]    = useState<ReportData | null>(null);

  const isProcessing = executionState !== 'idle'
    && executionState !== 'complete'
    && executionState !== 'error';

  const pushEntry = useCallback((type: FeedEntry['type'], text: string) => {
    setFeedEntries(prev => [...prev, { id: feId(), ts: Date.now(), text, type }]);
  }, []);

  const handleSend = useCallback(async (text: string) => {
    /* 1. Reset panels, capture command */
    setCommand(text);
    setFeedEntries([]);
    setNodes([]);
    setToolCalls([]);
    setReportData(null);
    setExecutionState('idle');

    try {
      /* 2. Run orchestration with lifecycle callbacks */
      const result = await runControlCycle(text, {

        onPlanning(profile) {
          setExecutionState('planning');
          setAgentsToInvoke(profile.agentsToInvoke);
          pushEntry('planning', 'Decomposing intent…');
        },

        onAgentStart(displayName) {
          setExecutionState('executing');
          pushEntry('agent', `Delegating to ${displayName}`);
        },

        onAgentComplete(_displayName, response, node) {
          setNodes(prev => [...prev, node]);
          setToolCalls(prev => [...prev, ...response.toolCalls]);
        },

        onSynthesis() {
          setExecutionState('synthesizing');
          pushEntry('synthesis', 'Converging findings…');
        },

        onComplete() {
          setExecutionState('complete');
          pushEntry('complete', 'Decision complete.');
        },
      });

      /* 3. Capture report */
      setReportData(result.reportData);

    } catch {
      setExecutionState('error');
      pushEntry('error', 'Execution error. Retry.');
    }
  }, [pushEntry]);

  const stateClass = styles[`s_${executionState}`] ?? '';

  return (
    <div className={`${styles.dashboard} ${stateClass}`}>
      {/* Progress bar */}
      <div className={styles.progressBar} />

      {/* Full-canvas energy overlay */}
      <div className={styles.energyOverlay} />

      {/* ── 2-column main layout: 30 % + 70 % ──────────── */}
      <div className={styles.main}>

        {/* Left 30 %: Command Feed */}
        <div className={styles.cmdFeed}>
          <CommandFeed
            command={command}
            feedEntries={feedEntries}
            reportData={reportData}
            isProcessing={isProcessing}
            executionState={executionState}
            onSend={handleSend}
          />
        </div>

        {/* Right 70 %: Orchestration Brain */}
        <div className={styles.brain}>
          <AgentFlowCanvas
            state={executionState}
            nodes={nodes}
            agentsToInvoke={agentsToInvoke}
          />
        </div>

      </div>

      {/* Operations log: collapsible right-edge drawer */}
      <OperationsDrawer calls={toolCalls} executionState={executionState} />
    </div>
  );
}

