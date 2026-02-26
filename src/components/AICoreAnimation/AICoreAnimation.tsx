/* ─────────────────────────────────────────────────────────
 *  AICoreAnimation — Oscillating Bezier spline AI core
 *
 *  Two layered SVG cubic Bézier curves with gradient
 *  cyan → teal. Control points oscillate via
 *  requestAnimationFrame, reading the current config from
 *  a ref so state transitions are instant with no RAF
 *  restart.
 *
 *  State drives: oscillation speed, amplitude, opacity,
 *  and accent colour for the secondary glow curve.
 * ───────────────────────────────────────────────────── */

import { useRef, useEffect } from 'react';
import type { ExecutionState } from '@/types/execution';
import styles from './AICoreAnimation.module.css';

interface AICoreAnimationProps {
  state: ExecutionState;
}

const STATE_LABEL: Record<ExecutionState, string> = {
  idle:         'Idle',
  planning:     'Planning',
  executing:    'Executing',
  synthesizing: 'Synthesizing',
  complete:     'Complete',
  error:        'Error',
};

interface StateCfg {
  speed:    number;
  amp:      number;
  opacity1: number;
  opacity2: number;
  accent:   string;
}

const STATE_CONFIG: Record<ExecutionState, StateCfg> = {
  idle:         { speed: 0.25, amp: 6,  opacity1: 0.40, opacity2: 0.18, accent: '#0d9488' },
  planning:     { speed: 0.55, amp: 14, opacity1: 0.65, opacity2: 0.30, accent: '#0ea5e9' },
  executing:    { speed: 1.40, amp: 24, opacity1: 0.90, opacity2: 0.45, accent: '#14b8a6' },
  synthesizing: { speed: 1.00, amp: 18, opacity1: 0.95, opacity2: 0.50, accent: '#6366f1' },
  complete:     { speed: 0.15, amp: 4,  opacity1: 0.28, opacity2: 0.10, accent: '#0d9488' },
  error:        { speed: 0.80, amp: 12, opacity1: 0.80, opacity2: 0.38, accent: '#ef4444' },
};

export default function AICoreAnimation({ state }: AICoreAnimationProps) {
  const path1Ref  = useRef<SVGPathElement>(null);
  const path2Ref  = useRef<SVGPathElement>(null);
  const stop1aRef = useRef<SVGStopElement>(null);
  const stop1bRef = useRef<SVGStopElement>(null);
  const rafRef    = useRef<number>(0);
  const stateRef  = useRef<ExecutionState>(state);

  /* Keep stateRef in sync so the RAF loop always reads latest config */
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /* Single persistent RAF loop — started once, never restarted */
  useEffect(() => {
    const tick = (ts: number) => {
      const t   = ts * 0.001;
      const cfg = STATE_CONFIG[stateRef.current];

      /* Primary curve control points */
      const cp1y1 = 50 + Math.sin(t * cfg.speed)               * cfg.amp;
      const cp2y1 = 50 - Math.cos(t * cfg.speed * 0.75)        * cfg.amp;
      /* Secondary curve — slightly offset phase */
      const cp1y2 = 50 - Math.sin(t * cfg.speed * 0.85 + 1.2)  * cfg.amp * 0.65;
      const cp2y2 = 50 + Math.cos(t * cfg.speed * 0.60 + 0.5)  * cfg.amp * 0.65;

      const d1 = `M 0 50 C 33 ${cp1y1.toFixed(1)} 67 ${cp2y1.toFixed(1)} 100 50`;
      const d2 = `M 0 50 C 33 ${cp1y2.toFixed(1)} 67 ${cp2y2.toFixed(1)} 100 50`;

      path1Ref.current?.setAttribute('d', d1);
      path2Ref.current?.setAttribute('d', d2);
      path1Ref.current?.setAttribute('opacity', String(cfg.opacity1));
      path2Ref.current?.setAttribute('opacity', String(cfg.opacity2));

      /* Update accent gradient colour for secondary curve */
      stop1aRef.current?.setAttribute('stop-color', cfg.accent);
      stop1bRef.current?.setAttribute('stop-color', cfg.accent);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <section className={`${styles.container} ${styles[state]}`}>
      {/* Ambient radial glow — colour/intensity controlled by CSS */}
      <div className={styles.ambient} />

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={styles.svg}
      >
        <defs>
          {/* Primary gradient: cyan → teal → cyan */}
          <linearGradient id="aiGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#06b6d4" stopOpacity="0" />
            <stop offset="20%"  stopColor="#22d3ee" stopOpacity="1" />
            <stop offset="50%"  stopColor="#0d9488" stopOpacity="1" />
            <stop offset="80%"  stopColor="#22d3ee" stopOpacity="1" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>

          {/* Accent gradient: driven by stateRef via DOM mutation */}
          <linearGradient id="aiGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop ref={stop1aRef} offset="0%"   stopColor="#0d9488" stopOpacity="0" />
            <stop offset="30%"  stopColor="#0d9488" stopOpacity="0.9" />
            <stop offset="70%"  stopColor="#0d9488" stopOpacity="0.9" />
            <stop ref={stop1bRef} offset="100%" stopColor="#0d9488" stopOpacity="0" />
          </linearGradient>

          {/* Soft bloom filter for primary line */}
          <filter id="bloom1" x="-10%" y="-150%" width="120%" height="400%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Wider glow filter for secondary curve */}
          <filter id="bloom2" x="-10%" y="-250%" width="120%" height="600%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Wide soft glow pass — secondary curve */}
        <path
          ref={path2Ref}
          d="M 0 50 C 33 50 67 50 100 50"
          fill="none"
          stroke="url(#aiGrad2)"
          strokeWidth="5"
          filter="url(#bloom2)"
          opacity={STATE_CONFIG[state].opacity2}
        />

        {/* Primary crisp spline */}
        <path
          ref={path1Ref}
          d="M 0 50 C 33 50 67 50 100 50"
          fill="none"
          stroke="url(#aiGrad1)"
          strokeWidth="1.6"
          filter="url(#bloom1)"
          opacity={STATE_CONFIG[state].opacity1}
        />
      </svg>

      <div className={styles.label}>
        <span className={styles.dot} />
        AI Core — {STATE_LABEL[state]}
      </div>
    </section>
  );
}


