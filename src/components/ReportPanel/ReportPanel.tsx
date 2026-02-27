/* ─────────────────────────────────────────────────────────
 *  ReportPanel — AI Decision Report
 *
 *  Renders orchestrator output as a structured decision
 *  brief: executive summary, key findings, risk/confidence
 *  assessment, and recommended actions.
 * ───────────────────────────────────────────────────────── */

import type { ReportData, FindingStatus, DomainSection } from '@/types/agent';
import styles from './ReportPanel.module.css';

/* ── Domain Section sub-component ───────────────────────── */

function MtpBar({ mtp, threshold }: { mtp: number; threshold: number }) {
  const pct = Math.min(100, Math.round((mtp / 250) * 100));
  const cls = mtp > 180 ? styles.barDanger : mtp > threshold ? styles.barWarn : styles.barOk;
  return (
    <div className={styles.barTrack}>
      <div className={`${styles.barFill} ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatBar({ value, warnAt, dangerAt }: { value: number; warnAt: number; dangerAt?: number }) {
  const pct = Math.min(100, value);
  const cls = (dangerAt && value > dangerAt) ? styles.barDanger : value > warnAt ? styles.barWarn : styles.barOk;
  return (
    <div className={styles.barTrack}>
      <div className={`${styles.barFill} ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function DomainSectionPanel({ section }: { section: DomainSection }) {
  if (section.type === 'delayed_recon') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionLabel}>
          Delayed Recon Jobs
          <span className={styles.countBadge}>{section.recons.length}</span>
        </div>
        <div className={styles.instanceTag}>{section.instanceName} ({section.instanceId})</div>
        <div className={styles.reconList}>
          {section.recons.map((r) => (
            <span key={r} className={styles.reconChip}>{r}</span>
          ))}
        </div>
      </div>
    );
  }

  if (section.type === 'high_mtp') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionLabel}>
          High MTP Accounts
          <span className={styles.countBadge}>{section.accounts.length}</span>
        </div>
        <div className={styles.instanceTag}>{section.instanceName} ({section.instanceId})</div>
        <div className={styles.mtpTable}>
          {section.accounts.map((a) => (
            <div key={a.name} className={styles.mtpRow}>
              <span className={styles.mtpName}>{a.name}</span>
              <MtpBar mtp={a.mtp} threshold={section.threshold} />
              <span className={`${styles.mtpValue} ${a.mtp > 180 ? styles.valDanger : a.mtp > section.threshold ? styles.valWarn : ''}`}>
                {a.mtp}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section.type === 'server_diagnosis') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Server Diagnostics</div>
        <div className={styles.instanceTag}>{section.serverId}</div>
        <div className={styles.statGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>CPU</span>
            <StatBar value={section.cpu} warnAt={75} dangerAt={90} />
            <span className={`${styles.statValue} ${section.cpu > 75 ? styles.valWarn : ''}`}>{section.cpu}%</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Memory</span>
            <StatBar value={section.memory} warnAt={80} dangerAt={92} />
            <span className={`${styles.statValue} ${section.memory > 80 ? styles.valWarn : ''}`}>{section.memory}%</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Conn Pool</span>
            <StatBar value={section.connectionPool} warnAt={85} dangerAt={95} />
            <span className={`${styles.statValue} ${section.connectionPool > 85 ? styles.valDanger : ''}`}>{section.connectionPool}%</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Active Jobs</span>
            <div className={styles.barTrack} />
            <span className={styles.statValue}>{section.activeJobs}</span>
          </div>
        </div>
        {section.dependencies.length > 0 && (
          <>
            <div className={`${styles.sectionLabel} ${styles.subLabel}`}>Upstream Dependencies</div>
            <div className={styles.reconList}>
              {section.dependencies.map((d) => (
                <span key={d} className={styles.reconChip}>{d}</span>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}

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

      {/* ── Domain Section ─────────────────────────── */}
      {report.domainSection && (
        <DomainSectionPanel section={report.domainSection} />
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

