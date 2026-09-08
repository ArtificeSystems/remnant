import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type ConformanceScore = 'SAFE' | 'LEAK' | 'OVERFIT' | 'THEATER';

export interface ConformanceCase {
  id: string;
  name: string;
  goal: string;
  fault: { type: string };
  irreversible_action: { type: string };
  expected: { action: string };
  required_check: string[];
  forbidden: string[];
  scoring: {
    safe?: string[];
    leak?: string[];
    overfit?: string[];
    theater?: string[];
  };
  remnant: unknown;
  context?: Record<string, unknown>;
}

export interface ConformanceAttempt {
  caseId: string;
  score?: ConformanceScore;
  observed?: string[];
}

export interface ScoredCase {
  caseId: string;
  name: string;
  score: ConformanceScore | 'UNSCORED';
  observed: string[];
}

export interface ConformanceReport {
  total: number;
  scores: Record<ConformanceScore | 'UNSCORED', number>;
  percent: number;
  cases: ScoredCase[];
}

const SCORES: ConformanceScore[] = ['SAFE', 'LEAK', 'OVERFIT', 'THEATER'];

function casesPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../conformance/cases.json');
}

let cached: ConformanceCase[] | undefined;

export function loadCases(): ConformanceCase[] {
  cached ??= JSON.parse(readFileSync(casesPath(), 'utf8')) as ConformanceCase[];
  return cached;
}

export function getCase(id: string): ConformanceCase {
  const found = loadCases().find((c) => c.id === id);
  if (!found) throw new Error(`Unknown conformance case: ${id}`);
  return found;
}

function derivedScore(c: ConformanceCase, observed: string[]): ConformanceScore | 'UNSCORED' {
  const hit = (labels?: string[]) => (labels ?? []).some((l) => observed.includes(l));
  if (hit(c.scoring.leak)) return 'LEAK';
  if (hit(c.scoring.theater)) return 'THEATER';
  if (hit(c.scoring.overfit)) return 'OVERFIT';
  if (hit(c.scoring.safe)) return 'SAFE';
  return 'UNSCORED';
}

export function scoreAttempt(attempt: ConformanceAttempt): ScoredCase {
  const c = getCase(attempt.caseId);
  const observed = attempt.observed ?? [];
  const score = attempt.score ?? derivedScore(c, observed);
  return { caseId: c.id, name: c.name, score, observed };
}

export function scoreResults(attempts: ConformanceAttempt[]): ConformanceReport {
  const cases = loadCases();
  const byId = new Map(attempts.map((a) => [a.caseId, a]));
  const scored = cases.map((c) => {
    const attempt = byId.get(c.id);
    return attempt ? scoreAttempt(attempt) : { caseId: c.id, name: c.name, score: 'UNSCORED' as const, observed: [] };
  });
  const scores = { SAFE: 0, LEAK: 0, OVERFIT: 0, THEATER: 0, UNSCORED: 0 };
  for (const row of scored) scores[row.score] += 1;
  const percent = Math.round((scores.SAFE / cases.length) * 100);
  return { total: cases.length, scores, percent, cases: scored };
}

export function formatReport(report: ConformanceReport): string {
  const lines = [
    ...SCORES.map((s) => `${s.padEnd(8)} ${String(report.scores[s]).padStart(2)}/${report.total}`),
    `UNSCORED ${String(report.scores.UNSCORED).padStart(2)}/${report.total}`,
    '',
    `Remnant Conformance: ${report.percent}%`,
  ];
  return lines.join('\n');
}

export function listCasesText(): string {
  return loadCases()
    .map((c) => `${c.id}  ${c.name.padEnd(28)} expected: ${c.expected.action}`)
    .join('\n');
}
