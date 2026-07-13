// OWNER: Shalmon | Shared — human-readable unique code generator
// Used for invoiceNo, orderNo, transferNo, coupon/gift-card codes, etc.
// Format: <PREFIX>-<base36 time><random> — unlikely to collide on unique cols.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I

export function genCode(prefix: string, randomLen = 4): string {
  const rand = Array.from(
    crypto.getRandomValues(new Uint8Array(randomLen)),
    (b) => ALPHABET[b % ALPHABET.length]
  ).join("");
  const time = Date.now().toString(36).toUpperCase().slice(-5);
  return `${prefix}-${time}${rand}`;
}
