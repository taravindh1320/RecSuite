/* ─────────────────────────────────────────────────────────
 *  RecSuite — Mock reconciliation domain dataset
 *
 *  In-memory representation of 4 recon instances (INV, SNPB,
 *  FX, ICG) and their associated servers. Used by domain-
 *  aware agents to return realistic, structured responses.
 * ───────────────────────────────────────────────────────── */

/* ── Type definitions ────────────────────────────────────── */

export interface MTPAccount {
  name: string;
  mtp:  number;
}

export interface ServerStats {
  id:              string;
  label:           string;
  cpu:             number;   // %
  memory:          number;   // %
  activeJobs:      number;
  connectionPool:  number;   // % utilisation
  instanceRef:     string;
}

export interface ReconInstance {
  id:               string;
  name:             string;
  delayedRecons:    string[];
  highMTPAccounts:  MTPAccount[];
  serverRef:        string;
}

/* ── Instance dataset ────────────────────────────────────── */

export const INSTANCES: Record<string, ReconInstance> = {
  INV: {
    id:   'INV',
    name: 'Investment Recon',
    delayedRecons:   ['goa.cash', 'nyk.cash', 'cen.cash'],
    highMTPAccounts: [
      { name: 'inv.equity.blotter', mtp: 143 },
      { name: 'inv.fx.hedge',       mtp: 117 },
    ],
    serverRef: 'INVRECON3P',
  },
  SNPB: {
    id:   'SNPB',
    name: 'S&P Bond Recon',
    delayedRecons:   ['snpb.bond.us', 'snpb.repo.overnight'],
    highMTPAccounts: [
      { name: 'snpb.fx.settlement', mtp: 184 },
      { name: 'snpb.liquidity',     mtp: 162 },
      { name: 'snpb.derivatives',   mtp: 201 },
    ],
    serverRef: 'SNPBRECON2P',
  },
  FX: {
    id:   'FX',
    name: 'FX Operations',
    delayedRecons:   ['fx.usd.eur', 'fx.gbp.jpy', 'fx.usd.chf', 'fx.aud.nzd'],
    highMTPAccounts: [
      { name: 'fx.spot.desk', mtp: 155 },
      { name: 'fx.ndf.latam', mtp: 178 },
    ],
    serverRef: 'FXRECON4P',
  },
  ICG: {
    id:   'ICG',
    name: 'Institutional Client Group',
    delayedRecons:   ['icg.prime.us', 'icg.custody.eu'],
    highMTPAccounts: [
      { name: 'icg.clearing.global', mtp: 199 },
      { name: 'icg.custody.us',      mtp: 138 },
      { name: 'icg.prime.apac',      mtp: 171 },
    ],
    serverRef: 'ICGRECON6P',
  },
};

/* ── Server dataset ──────────────────────────────────────── */

export const SERVERS: Record<string, ServerStats> = {
  ICGRECON6P: {
    id:             'ICGRECON6P',
    label:          'ICGRECON6P',
    cpu:            78,
    memory:         83,
    activeJobs:     412,
    connectionPool: 91,
    instanceRef:    'ICG',
  },
  INVRECON3P: {
    id:             'INVRECON3P',
    label:          'INVRECON3P',
    cpu:            45,
    memory:         61,
    activeJobs:     188,
    connectionPool: 54,
    instanceRef:    'INV',
  },
  SNPBRECON2P: {
    id:             'SNPBRECON2P',
    label:          'SNPBRECON2P',
    cpu:            62,
    memory:         70,
    activeJobs:     247,
    connectionPool: 68,
    instanceRef:    'SNPB',
  },
  FXRECON4P: {
    id:             'FXRECON4P',
    label:          'FXRECON4P',
    cpu:            55,
    memory:         58,
    activeJobs:     312,
    connectionPool: 72,
    instanceRef:    'FX',
  },
};

/* ── Dependency graph: jobs each recon depends on ───────── */

export const JOB_DEPENDENCIES: Record<string, string[]> = {
  'goa.cash':              ['eod.batch.goa', 'position.feed.goa', 'fx.rate.snapshot'],
  'nyk.cash':              ['eod.batch.nyk', 'settlement.feed.nyk'],
  'cen.cash':              ['eod.batch.cen', 'clearing.confirm.cen'],
  'snpb.bond.us':          ['bond.price.feed', 'cusip.resolver', 'settlement.stp'],
  'snpb.repo.overnight':   ['repo.rate.feed', 'haircut.calculator', 'collateral.mgr'],
  'snpb.fx.settlement':    ['fx.rate.snapshot', 'settlement.stp', 'netting.calc'],
  'fx.usd.eur':            ['fx.rate.snapshot', 'ecb.rate.feed', 'trade.blotter.fx'],
  'fx.gbp.jpy':            ['fx.rate.snapshot', 'boe.rate.feed', 'trade.blotter.fx'],
  'fx.usd.chf':            ['fx.rate.snapshot', 'snb.rate.feed'],
  'fx.aud.nzd':            ['fx.rate.snapshot', 'rba.rate.feed'],
  'icg.prime.us':          ['prime.broker.feed', 'margin.calc.us', 'collateral.mgr'],
  'icg.custody.eu':        ['custody.feed.eu', 'asset.servicer.eu', 'csd.confirm'],
};

/* ── Lookup helpers ──────────────────────────────────────── */

/** Resolve instance from free-text input (case-insensitive key match). */
export function resolveInstance(text: string): ReconInstance | null {
  const upper = text.toUpperCase();
  for (const key of Object.keys(INSTANCES)) {
    if (upper.includes(key)) return INSTANCES[key];
  }
  return null;
}

/** Resolve server from free-text input (case-insensitive ID match,
 *  or fallback to instance's serverRef). */
export function resolveServer(text: string): ServerStats | null {
  const upper = text.toUpperCase();
  for (const key of Object.keys(SERVERS)) {
    if (upper.includes(key)) return SERVERS[key];
  }
  // If an instance is mentioned, return its server
  const inst = resolveInstance(text);
  if (inst) return SERVERS[inst.serverRef] ?? null;
  return null;
}

/** Get upstream job dependencies for a list of recon names. */
export function getDependencies(recons: string[]): string[] {
  const deps = new Set<string>();
  for (const r of recons) {
    for (const d of (JOB_DEPENDENCIES[r] ?? [])) deps.add(d);
  }
  return [...deps];
}
