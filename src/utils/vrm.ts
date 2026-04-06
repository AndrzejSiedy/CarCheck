// UK VRM validation and formatting

// Current format (2001+):   AB12 CDE
// Prefix format (1983–2001): A123 BCD
// Suffix format (1963–1983): ABC 123D
const PATTERNS = [
  /^[A-Z]{2}[0-9]{2}[A-Z]{3}$/,   // current
  /^[A-Z][0-9]{1,3}[A-Z]{3}$/,    // prefix
  /^[A-Z]{3}[0-9]{1,3}[A-Z]$/,    // suffix
];

export function normalise(vrm: string): string {
  return vrm.toUpperCase().replace(/\s+/g, '');
}

export function isValidVRM(vrm: string): boolean {
  const n = normalise(vrm);
  return PATTERNS.some(p => p.test(n));
}
