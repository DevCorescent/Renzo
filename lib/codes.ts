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

// A HIGH-ENTROPY code for gift cards, which double as the secure redemption token.
// 16 crypto-random chars from a 32-symbol alphabet → 32^16 ≈ 1.2e24 keyspace, so the
// code is collision-resistant and infeasible to guess. Grouped 4-4-4-4 for humans.
// (32 divides 256 evenly, so `b % 32` is unbiased.) The DB unique constraint on
// GiftCard.code is the final collision backstop; callers retry on the rare clash.
export function genGiftCardCode(): string {
  const chars = Array.from(
    crypto.getRandomValues(new Uint8Array(16)),
    (b) => ALPHABET[b % ALPHABET.length]
  );
  const groups = [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join(""));
  return `GC-${groups.join("-")}`;
}
