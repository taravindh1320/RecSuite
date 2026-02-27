/* ─────────────────────────────────────────────────────────
 *  ReportPanel — AI Decision Report
 *
 *  Renders orchestrator output as a structured decision
 *  brief: executive summary, key findings, risk/confidence
 *  assessment, and recommended actions.
 * ───────────────────────────────────────────────────────── */

import type { ReportData, FindingStatus } from '@/types/agent';
import styles from './ReportPanel.module.css';

interface ReportPanelProps {
  report: ReportData;
}

/* ── Helpers ─────────────────────────────────────────────── */

function StatusDot({ status }: { status: FindingStatus }) {
  return <span className={`${styles.statusDot} ${styles['dot_' + status]}`} />;
}

function RiskBadge({ level }: { level: string }) {
  const cls = styles['risk_' + level.toLowerCase()] ?? '';
  return (
    <span className={`${styles.riskBadge} ${cls}`}>
      {level.toUpperCase()}
    </span>
  );
}

/** Parse confidence % from a keyFindings value string, e.g. "92% confidence" */
function extractConfidence(findings: ReportData['keyFindings']): number | null {
  for (const f of findings) {
    const m = f.value.match(/(\d{1,3})\s*%/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

/* ── Component ───────────────────────────────────────────── */

export default function ReportPanel({ report }: ReportPanelProps) {
  const ts = new Date(report.executedAt).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const confidence = extractConfidence(report.keyFindings);

  return (
    <div className={styles.panel}>

      {/* ── Header ─────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.reportLabel}>AI DECISION REPORT</div>
        <div className={styles.headerMeta}>
          {report.domain !== 'general' && (
            <span className={styles.domain}>{report.domain.toUpperCase()}</span>
          )}
          <span className={styles.ts}>{ts}</span>
        </div>
      </div>

      {/* ── Executive Summary ──────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Executive Summary</div>
        <p className={styles.summary}>{report.summary}</p>
      </div>

      {/* ── Risk + Confidence row ──────────────────── */}
      <div className={styles.riskRow}>
        <div className={styles.riskCell}>
          <div className={styles.sectionLabel}>Risk Level</div>
          <RiskBadge level={report.severity} />
        </div>
        {confidence !== null && (
          <div className={styles.riskCell}>
            <div className={styles.sectionLabel}>Confidence</div>
            <div className={styles.confidenceBar}>
              <div
                className={styles.confidenceFill}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className={styles.confidenceNum}>{confidence}%</span>
          </div>
        )}
      </div>

      {/* ── Key Findings ───────────────────────────── */}
      {report.keyFindings.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Key Findings</div>
          <div className={styles.findingsList}>
            {report.keyFindings.map((f, i) => (
              <div key={i} className={styles.findingItem}>
                <div className={styles.findingTop}>
                  <StatusDot status={f.status} />
                  <span className={styles.findingLabel}>{f.label}</span>
                </div>
                <div className={styles.findingValue}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recommended Actions ────────────────────── */}
      {report.recommendedActions.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Recommended Actions</div>
          <ol className={styles.actionList}>
            {report.recommendedActions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ol>
        </div>
      )}

    </div>
  );
}

