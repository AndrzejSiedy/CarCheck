// Deterministic scoring engine — five rules, no AI
// Weights defined in /docs/spec.md

import type { MotHistory, MotTest, Flag, ScoringResult } from '../types/mot';

// ─── helpers ──────────────────────────────────────────────────────────────────

function carAgeYears(firstUsedDate: string): number {
  const first = new Date(firstUsedDate).getFullYear();
  return new Date().getFullYear() - first;
}

function monthsBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return Math.abs(
    (da.getFullYear() - db.getFullYear()) * 12 + (da.getMonth() - db.getMonth())
  );
}

// ─── rules ────────────────────────────────────────────────────────────────────

function ruleLatestResult(latest: MotTest): { points: number; flag: Flag | null } {
  if (latest.testResult === 'PASSED') {
    return { points: 60, flag: null };
  }
  return {
    points: -40,
    flag: {
      type: 'recent_fail',
      severity: 'critical',
      label: 'Recent MOT failure',
      detail: `Latest MOT on ${latest.completedDate} was a FAIL`,
    },
  };
}

function ruleAdvisories(latest: MotTest, ageYears: number): { points: number; flag: Flag | null } {
  const count = latest.advisories.length;
  if (count === 0) return { points: 0, flag: null };

  const penaltyPer = ageYears < 3 ? 8 : ageYears <= 6 ? 5 : 3;
  const points = -Math.min(count * penaltyPer, 30);

  return {
    points,
    flag: {
      type: 'advisory',
      severity: count >= 4 ? 'warning' : 'info',
      label: `${count} advisory item${count > 1 ? 's' : ''}`,
      detail: latest.advisories.join(' · '),
    },
  };
}

function ruleMileageRollback(tests: MotTest[]): { points: number; flag: Flag | null } {
  if (tests.length < 2) return { points: 0, flag: null };

  // tests ordered newest first — compare pairs (newer, older)
  for (let i = 0; i < tests.length - 1; i++) {
    const newer = tests[i];
    const older = tests[i + 1];
    const delta = newer.odometerValue - older.odometerValue;

    if (delta < 0) {
      return {
        points: -25,
        flag: {
          type: 'mileage_anomaly',
          severity: 'critical',
          label: 'Mileage rollback detected',
          detail: `Odometer dropped from ${older.odometerValue} to ${newer.odometerValue} mi between ${older.completedDate} and ${newer.completedDate}`,
        },
      };
    }

    // Suspicious: < 1000 miles in a year (non-classic)
    const months = monthsBetween(newer.completedDate, older.completedDate);
    const annualised = months > 0 ? (delta / months) * 12 : delta;
    if (annualised < 1000 && delta > 0) {
      return {
        points: -10,
        flag: {
          type: 'mileage_anomaly',
          severity: 'warning',
          label: 'Unusually low mileage',
          detail: `Only ~${Math.round(annualised)} miles/year between ${older.completedDate} and ${newer.completedDate}`,
        },
      };
    }
  }

  return { points: 0, flag: null };
}

function ruleMOTGaps(tests: MotTest[]): { points: number; flag: Flag | null } {
  if (tests.length < 2) return { points: 0, flag: null };

  let totalPenalty = 0;
  const gapDetails: string[] = [];

  for (let i = 0; i < tests.length - 1; i++) {
    const gap = monthsBetween(tests[i].completedDate, tests[i + 1].completedDate);
    if (gap > 13) {
      totalPenalty += 10;
      gapDetails.push(`${gap}-month gap before ${tests[i].completedDate}`);
    }
  }

  const points = -Math.min(totalPenalty, 20);
  if (points === 0) return { points: 0, flag: null };

  return {
    points,
    flag: {
      type: 'test_gap',
      severity: 'warning',
      label: `MOT gap${gapDetails.length > 1 ? 's' : ''} detected`,
      detail: gapDetails.join(' · '),
    },
  };
}

function ruleTaxiPattern(tests: MotTest[]): { points: number; flag: Flag | null } {
  if (tests.length < 4) return { points: 0, flag: null };

  // Count consecutive pairs where gap is 5–7 months (6-monthly MOT cadence)
  let taxiGaps = 0;
  for (let i = 0; i < tests.length - 1; i++) {
    const gap = monthsBetween(tests[i].completedDate, tests[i + 1].completedDate);
    if (gap >= 5 && gap <= 7) taxiGaps++;
  }

  const ratio = taxiGaps / (tests.length - 1);
  if (ratio < 0.5) return { points: 0, flag: null };

  return {
    points: -15,
    flag: {
      type: 'advisory',
      severity: 'warning',
      label: 'Probable taxi or private hire history',
      detail: `${taxiGaps} of ${tests.length - 1} MOT intervals are ~6 months apart — the legal cadence for UK taxis. Expect higher wear than mileage suggests.`,
    },
  };
}

function ruleCleanStreak(tests: MotTest[]): { points: number; flag: Flag | null } {
  let streak = 0;
  for (const t of tests) {
    if (t.testResult === 'PASSED') streak++;
    else break;
  }

  let bonus = 0;
  if (streak >= 7) bonus = 15;
  else if (streak >= 5) bonus = 10;
  else if (streak >= 3) bonus = 5;

  if (bonus === 0) return { points: 0, flag: null };

  return {
    points: bonus,
    flag: {
      type: 'clean_streak',
      severity: 'info',
      label: `${streak} consecutive passes`,
      detail: `Vehicle has passed ${streak} consecutive MOT tests`,
    },
  };
}

// ─── main export ──────────────────────────────────────────────────────────────

export function score(history: MotHistory): ScoringResult {
  if (!history.motTests || history.motTests.length === 0) {
    return {
      score: 0,
      verdict: 'avoid',
      flags: [{
        type: 'recent_fail',
        severity: 'critical',
        label: 'No MOT history',
        detail: 'No MOT records found for this vehicle',
      }],
    };
  }

  const latest = history.motTests[0];
  const ageYears = carAgeYears(history.firstUsedDate);
  const flags: Flag[] = [];
  let points = 0;

  const r1 = ruleLatestResult(latest);
  const r2 = ruleAdvisories(latest, ageYears);
  const r3 = ruleMileageRollback(history.motTests);
  const r4 = ruleMOTGaps(history.motTests);
  const r5 = ruleCleanStreak(history.motTests);
  const r6 = ruleTaxiPattern(history.motTests);

  points = r1.points + r2.points + r3.points + r4.points + r5.points + r6.points;
  [r1.flag, r2.flag, r3.flag, r4.flag, r5.flag, r6.flag]
    .filter((f): f is Flag => f !== null)
    .forEach(f => flags.push(f));

  const final = Math.max(0, Math.min(100, points));
  const verdict: ScoringResult['verdict'] =
    final >= 85 ? 'great' : final >= 65 ? 'ok' : final >= 40 ? 'caution' : 'avoid';

  return { score: final, verdict, flags };
}
