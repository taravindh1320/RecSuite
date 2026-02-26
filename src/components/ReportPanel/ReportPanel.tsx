/* ─────────────────────────────────────────────────────────
 *  ReportPanel — Structured analysis report
 *
 *  Renders the structured ReportData produced by the
 *  orchestrator into a professional enterprise-style
 *  report card: header, summary, key findings table,
 *  impact scope, and recommended actions.
 * ───────────────────────────────────────────────────────── */

import type { ReportData, FindingStatus } from '@/types/agent';
import styles from './ReportPanel.module.css';

interface ReportPanelProps {
  report: ReportData;
}

/* ── Badge for severity / finding status ─────────────────── */

function SeverityBadge({ level }: { level: string }) {
  return (
    <span className={`${styles.badge} ${styles['badge_' + level.toLowerCase()]}`}>
      {level.toUpperCase()}
    </span>
  );
}

function StatusDot({ status }: { status: FindingStatus }) {
  return <span className={`${styles.statusDot} ${styles['dot_' + status]}`} />;
}

/* ── Component ───────────────────────────────────────────── */

export default function ReportPanel({ report }: ReportPanelProps) {
  const ts = new Date(report.executedAt).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className={styles.panel}>
      {/* ── Header ──────────────────────────── */}
      <div className={styles.header}>
        <span className={styles.title}>{report.title}</span>
        <div className={styles.meta}>
          <SeverityBadge level={report.severity} />
          {report.domain !== 'general' && (
            <span className={styles.domain}>{report.domain}</span>
          )}
          <span className={styles.ts}>{ts}</span>
        </div>
      </div>

      {/* ── Summary ─────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Summary</div>
        <p className={styles.summary}>{report.summary}</p>
      </div>

      {/* ── Key Findings ────────────────────── */}
      {report.keyFindings.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Key Findings</div>
          <table className={styles.findings}>
            <tbody>
              {report.keyFindings.map((f, i) => (
                <tr key={i} className={styles.findingRow}>
                  <td className={styles.findingLabel}>{f.label}</td>
                  <td className={styles.findingValue}>{f.value}</td>
                  <td className={styles.findingStatus}>
                    <StatusDot status={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Impact Scope ────────────────────── */}
      {report.impactScope.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Impact Scope</div>
          <ul className={styles.list}>
            {report.impactScope.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Recommended Actions ─────────────── */}
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
