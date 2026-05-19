// ─── ID generation ────────────────────────────────────────────────
// Uses the Web Crypto API which is available in all modern browsers
// and in Node 19+ (for tests). Never use Math.random() for IDs.

export const generateId = (): string => crypto.randomUUID()
