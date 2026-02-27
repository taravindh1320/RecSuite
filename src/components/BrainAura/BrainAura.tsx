/* ─────────────────────────────────────────────────────────
 *  BrainAura — VIKI-inspired kinetic crown above Orchestrator
 *
 *  Renders as an SVG <g> group; place inside the parent SVG
 *  via transform="translate(cx, cy)". Three concentric rings
 *  with rotation + opacity animations driven by executionState.
 *
 *  Ring geometry (relative to center 0,0):
 *    Inner  r=66  — clockwise rotation
 *    Middle r=82  — counter-clockwise rotation
 *    Outer  r=97  — opacity breathing
 *    Orbit  r=88  — single particle dot
 * ───────────────────────────────────────────────────────── */

import type { ExecutionState } from '@/types/execution';
import styles from './BrainAura.module.css';

interface BrainAuraProps {
  state: ExecutionState;
  cx?:   number;   // translate x in parent SVG coords
  cy?:   number;   // translate y
}

/* Speed multipliers per state (applied as inline style to control
   animation-duration; CSS custom props not usable inside SVG class easily) */
const SPEED: Record<ExecutionState, number> = {
  idle:         1,
  planning:     1.6,
  executing:    2.6,
  synthesizing: 2.0,
  complete:     0.6,
  error:        1.2,
};

/* ── Inner ring segment descriptors ─────────────────────── */
// 12 equal arcs with gaps — gives a segmented crown look
function arcDescriptor(r: number, segments: number, gapDeg: number): string {
  const step   = 360 / segments;
  const arc    = step - gapDeg;
  const paths: string[] = [];
  for (let i = 0; i < segments; i++) {
    const startDeg = i * step;
    const endDeg   = startDeg + arc;
    const toRad    = (d: number) => (d * Math.PI) / 180;
    const sx = r * Math.cos(toRad(startDeg - 90));
    const sy = r * Math.sin(toRad(startDeg - 90));
    const ex = r * Math.cos(toRad(endDeg   - 90));
    const ey = r * Math.sin(toRad(endDeg   - 90));
    const large = arc > 180 ? 1 : 0;
    paths.push(`M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`);
  }
  return paths.join(' ');
}

/* ── Component ───────────────────────────────────────────── */

export default function BrainAura({ state, cx = 0, cy = 0 }: BrainAuraProps) {
  const speed  = SPEED[state];
  const stCls  = styles[`s_${state}`] ?? '';

  /* Inline style overrides for speed; base durations in CSS */
  const innerStyle  = { animationDuration: `${(18 / speed).toFixed(1)}s` };
  const middleStyle = { animationDuration: `${(26 / speed).toFixed(1)}s` };
  const outerStyle  = { animationDuration: `${(4.5 / speed).toFixed(1)}s` };
  const orbitStyle  = { animationDuration: `${(10 / speed).toFixed(1)}s` };

  return (
    <g transform={`translate(${cx}, ${cy})`} className={`${styles.aura} ${stCls}`}>

      {/* ── SVG defs: gradient + glow filter ─────────── */}
      <defs>
        <linearGradient id="auraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.7" />
        </linearGradient>
        <filter id="auraGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="auraGlowStrong" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="dotGlowAura" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Error ripple gradient */}
        <radialGradient id="errorRipple" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#ef4444" stopOpacity="0" />
          <stop offset="70%"  stopColor="#ef4444" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
        {/* Synthesize ripple */}
        <radialGradient id="synthRipple" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#6366f1" stopOpacity="0" />
          <stop offset="70%"  stopColor="#22d3ee" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── Outer ring — opacity breathing ────────────── */}
      <g
        className={styles.outerRing}
        style={outerStyle}
        filter="url(#auraGlow)"
      >
        <circle
          cx="0" cy="0" r="97"
          fill="none"
          stroke="url(#auraGrad)"
          strokeWidth="0.6"
          strokeOpacity="0.18"
          className={styles.outerCircle}
        />
        <path
          d={arcDescriptor(97, 6, 18)}
          fill="none"
          stroke="url(#auraGrad)"
          strokeWidth="0.5"
          strokeOpacity="0.12"
          strokeLinecap="round"
        />
      </g>

      {/* ── Middle ring — counter-clockwise ───────────── */}
      <g
        className={styles.middleRing}
        style={middleStyle}
        filter="url(#auraGlow)"
      >
        <path
          d={arcDescriptor(82, 8, 10)}
          fill="none"
          stroke="url(#auraGrad)"
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeOpacity="0.3"
        />
        {/* 4 tick marks */}
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const ix  = 77 * Math.cos(rad); const iy = 77 * Math.sin(rad);
          const ox  = 87 * Math.cos(rad); const oy = 87 * Math.sin(rad);
          return (
            <line
              key={deg}
              x1={ix.toFixed(2)} y1={iy.toFixed(2)}
              x2={ox.toFixed(2)} y2={oy.toFixed(2)}
              stroke="url(#auraGrad)"
              strokeWidth="1"
              strokeOpacity="0.22"
              strokeLinecap="round"
            />
          );
        })}
      </g>

      {/* ── Inner ring — clockwise ─────────────────────── */}
      <g
        className={styles.innerRing}
        style={innerStyle}
        filter="url(#auraGlowStrong)"
      >
        <path
          d={arcDescriptor(66, 10, 6)}
          fill="none"
          stroke="url(#auraGrad)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.5"
        />
      </g>

      {/* ── Orbiting particle dot ──────────────────────── */}
      <g className={styles.orbit} style={orbitStyle}>
        <circle
          cx="88" cy="0"
          r="2.5"
          fill="url(#auraGrad)"
          opacity="0.7"
          filter="url(#dotGlowAura)"
        />
      </g>

      {/* ── Synthesizing outward ripple ───────────────── */}
      {(state === 'synthesizing') && (
        <circle
          cx="0" cy="0" r="70"
          fill="url(#synthRipple)"
          className={styles.synthRipple}
        />
      )}

      {/* ── Error ripple ──────────────────────────────── */}
      {state === 'error' && (
        <circle
          cx="0" cy="0" r="75"
          fill="url(#errorRipple)"
          className={styles.errorRipple}
        />
      )}

    </g>
  );
}
