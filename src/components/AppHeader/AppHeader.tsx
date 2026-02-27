/* ─────────────────────────────────────────────────────────
 *  AppHeader — Application top bar
 *
 *  Left:   AI logo + RecSuite wordmark + subtitle
 *  Center: System status indicator (colour-keyed to executionState)
 *  Right:  Environment badge + user role badge
 * ───────────────────────────────────────────────────────── */

import type { ExecutionState } from '@/types/execution';
import styles from './AppHeader.module.css';

interface AppHeaderProps {
  executionState: ExecutionState;
  environment?:   string;       // default "PROD"
  userRole?:      string;       // default "ANALYST"
}

/* ── Status config ───────────────────────────────────────── */

const STATUS_CONFIG: Record<ExecutionState, { label: string; cls: string; pulse: boolean }> = {
  idle:         { label: 'IDLE',         cls: styles.stIdle,        pulse: false },
  planning:     { label: 'PLANNING',     cls: styles.stPlanning,    pulse: true  },
  executing:    { label: 'EXECUTING',    cls: styles.stExecuting,   pulse: true  },
  synthesizing: { label: 'SYNTHESIZING', cls: styles.stSynthesizing, pulse: true },
  complete:     { label: 'COMPLETE',     cls: styles.stComplete,    pulse: false },
  error:        { label: 'ERROR',        cls: styles.stError,       pulse: false },
};

/* ── AI Logo SVG ─────────────────────────────────────────── */

function AiLogo() {
  return (
    <svg
      className={styles.logo}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter id="hdr-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="hdr-grad-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        <linearGradient id="hdr-grad-b" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#818cf8" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      {/* Outer ring */}
      <circle
        cx="20" cy="20" r="16"
        stroke="url(#hdr-grad-a)" strokeWidth="1.25"
        filter="url(#hdr-glow)"
      />

      {/* Orbital arc 1 — tilted ~40 ° */}
      <ellipse
        cx="20" cy="20" rx="16" ry="6.5"
        stroke="url(#hdr-grad-a)" strokeWidth="0.9"
        transform="rotate(40 20 20)"
        strokeDasharray="18 14"
        filter="url(#hdr-glow)"
      />

      {/* Orbital arc 2 — tilted ~−40 ° */}
      <ellipse
        cx="20" cy="20" rx="16" ry="6.5"
        stroke="url(#hdr-grad-b)" strokeWidth="0.9"
        transform="rotate(-40 20 20)"
        strokeDasharray="12 20"
        filter="url(#hdr-glow)"
      />

      {/* Inner dot */}
      <circle
        cx="20" cy="20" r="2.8"
        fill="url(#hdr-grad-a)"
        filter="url(#hdr-glow)"
      />

      {/* Small accent dot on outer ring */}
      <circle cx="20" cy="4" r="1.6" fill="#22d3ee" opacity="0.9" />
    </svg>
  );
}

/* ── Component ───────────────────────────────────────────── */

export default function AppHeader({
  executionState,
  environment = 'PROD',
  userRole    = 'ANALYST',
}: AppHeaderProps) {
  const status = STATUS_CONFIG[executionState] ?? STATUS_CONFIG.idle;

  return (
    <header className={styles.header}>

      {/* ── Left: Brand ──────────────────────────────── */}
      <div className={styles.brand}>
        <AiLogo />
        <div className={styles.wordmark}>
          <span className={styles.appName}>RecSuite</span>
          <span className={styles.appSub}>Autonomous Control Plane</span>
        </div>
      </div>

      {/* ── Center: System status ────────────────────── */}
      <div className={styles.statusWrap}>
        <div className={`${styles.statusPill} ${status.cls}`}>
          <span className={`${styles.statusDot} ${status.pulse ? styles.statusDotPulse : ''}`} />
          <span className={styles.statusLabel}>{status.label}</span>
        </div>
      </div>

      {/* ── Right: Badges ────────────────────────────── */}
      <div className={styles.badges}>
        <span className={`${styles.badge} ${styles.badgeEnv}`}>{environment}</span>
        <span className={`${styles.badge} ${styles.badgeRole}`}>{userRole}</span>
      </div>

    </header>
  );
}
