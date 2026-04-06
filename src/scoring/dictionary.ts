// MOT dictionary loader and phrase matcher
// Maps advisory phrase substrings to risk signals.
// Severity: 1 (minor) → 10 (critical). See /docs/mot-dictionary.md.

export interface DictionaryEntry {
  pattern: string;       // lowercase substring match against advisory text
  category: string;
  severity: number;      // 1–10
  signal: string;        // short display label
  ageWeight: boolean;    // if true, severity penalty increases on newer cars
}

export const DICTIONARY: DictionaryEntry[] = [
  // Brakes
  { pattern: 'brake pad',            category: 'brakes',     severity: 7, signal: 'Brake pad wear',          ageWeight: true  },
  { pattern: 'brake disc',           category: 'brakes',     severity: 7, signal: 'Brake disc wear',         ageWeight: true  },
  { pattern: 'brake fluid',          category: 'brakes',     severity: 6, signal: 'Brake fluid issue',       ageWeight: false },
  { pattern: 'brake pipe',           category: 'brakes',     severity: 8, signal: 'Brake pipe corrosion',    ageWeight: false },
  { pattern: 'brake hose',           category: 'brakes',     severity: 7, signal: 'Brake hose issue',        ageWeight: false },
  { pattern: 'handbrake',            category: 'brakes',     severity: 5, signal: 'Handbrake advisory',      ageWeight: false },

  // Tyres
  { pattern: 'tyre worn',            category: 'tyres',      severity: 7, signal: 'Tyre wear',               ageWeight: false },
  { pattern: 'tyre close to legal',  category: 'tyres',      severity: 6, signal: 'Tyre near limit',         ageWeight: false },
  { pattern: 'tyre wall',            category: 'tyres',      severity: 7, signal: 'Tyre wall damage',        ageWeight: false },
  { pattern: 'tyre crack',           category: 'tyres',      severity: 6, signal: 'Tyre cracking',           ageWeight: false },
  { pattern: 'tyre bulge',           category: 'tyres',      severity: 9, signal: 'Tyre bulge',              ageWeight: false },
  { pattern: 'tyre aged',            category: 'tyres',      severity: 5, signal: 'Aged tyres',              ageWeight: false },

  // Suspension
  { pattern: 'shock absorber',       category: 'suspension', severity: 7, signal: 'Shock absorber wear',     ageWeight: true  },
  { pattern: 'coil spring',          category: 'suspension', severity: 8, signal: 'Spring advisory',         ageWeight: false },
  { pattern: 'suspension arm',       category: 'suspension', severity: 7, signal: 'Suspension arm wear',     ageWeight: true  },
  { pattern: 'anti-roll bar',        category: 'suspension', severity: 5, signal: 'Anti-roll bar bush',      ageWeight: true  },
  { pattern: 'ball joint',           category: 'suspension', severity: 7, signal: 'Ball joint wear',         ageWeight: true  },

  // Steering
  { pattern: 'steering rack',        category: 'steering',   severity: 8, signal: 'Steering rack wear',      ageWeight: true  },
  { pattern: 'track rod',            category: 'steering',   severity: 7, signal: 'Track rod wear',          ageWeight: true  },
  { pattern: 'power steering',       category: 'steering',   severity: 6, signal: 'Power steering issue',    ageWeight: false },

  // Bodywork / corrosion
  { pattern: 'corrosion',            category: 'bodywork',   severity: 6, signal: 'Corrosion present',       ageWeight: false },
  { pattern: 'structural',           category: 'bodywork',   severity: 9, signal: 'Structural concern',      ageWeight: false },
  { pattern: 'sill',                 category: 'bodywork',   severity: 6, signal: 'Sill corrosion',          ageWeight: false },

  // Engine / exhaust
  { pattern: 'oil leak',             category: 'engine',     severity: 6, signal: 'Oil leak',                ageWeight: false },
  { pattern: 'engine mount',         category: 'engine',     severity: 6, signal: 'Engine mount wear',       ageWeight: true  },
  { pattern: 'exhaust',              category: 'engine',     severity: 5, signal: 'Exhaust advisory',        ageWeight: false },

  // Lights
  { pattern: 'headlight',            category: 'lights',     severity: 4, signal: 'Headlight issue',         ageWeight: false },
  { pattern: 'brake light',          category: 'lights',     severity: 5, signal: 'Brake light issue',       ageWeight: false },
  { pattern: 'indicator',            category: 'lights',     severity: 3, signal: 'Indicator issue',         ageWeight: false },
];

/** Returns the highest-severity entry matching the advisory text, or null. */
export function matchAdvisory(advisory: string): DictionaryEntry | null {
  const lower = advisory.toLowerCase();
  let best: DictionaryEntry | null = null;
  for (const entry of DICTIONARY) {
    if (lower.includes(entry.pattern)) {
      if (!best || entry.severity > best.severity) best = entry;
    }
  }
  return best;
}
