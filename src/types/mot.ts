// Shared type definitions — MotHistory schema matches DVSA MOT History API v1 response

export interface MotTest {
  completedDate: string;       // "2023-11-15"
  testResult: 'PASSED' | 'FAILED';
  odometerValue: number;       // miles
  odometerUnit: 'MI' | 'KM';
  advisories: string[];        // raw DVSA advisory phrase strings
  testStation?: string;
}

export interface MotHistory {
  registration: string;        // normalised VRM e.g. "LD19KXA"
  make: string;
  model: string;
  firstUsedDate: string;       // "2019-04-01"
  motTests: MotTest[];         // ordered newest first
}

export interface Flag {
  type: 'mileage_anomaly' | 'advisory' | 'test_gap' | 'recent_fail' | 'clean_streak';
  severity: 'info' | 'warning' | 'critical';
  label: string;
  detail: string;
}

export interface ScoringResult {
  score: number;               // 0–100
  verdict: 'great' | 'ok' | 'caution' | 'avoid';
  flags: Flag[];
}

export interface ScanResult {
  vrm: string;
  make: string;
  model: string;
  scannedAt: number;           // unix timestamp
  source: 'autotrader' | 'ebay' | 'gumtree' | 'facebook';
  score: number;
  verdict: ScoringResult['verdict'];
  flags: Flag[];
  motHistory: MotHistory;
  cached: boolean;
}
