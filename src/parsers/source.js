const SOURCE_PATTERNS = [
  { source: "OVO", pattern: /\bovo\b/i },
  { source: "GOPAY", pattern: /(gopay|go-?jek|gojek)/i },
  { source: "DANA", pattern: /\bdana\b/i },
  { source: "SHOPEEPAY", pattern: /(shopeepay|shopee\s*pay|shopeepay|spay)/i },
];

/**
 * Tentukan sumber dana dari nama pengirim atau isi teks SMS.
 * Mengembalikan null bila tidak dikenali.
 */
export function detectSource(sender, text) {
  const haystack = `${sender ?? ""} ${text ?? ""}`;
  for (const { source, pattern } of SOURCE_PATTERNS) {
    if (pattern.test(haystack)) return source;
  }
  return null;
}

/**
 * True bila SMS terlihat sebagai promosi/iklan, bukan notifikasi transaksi.
 */
export function isPromotional(text) {
  if (!text) return false;
  return /(promo|diskon|voucher|kupon|undian|hadiah|gratis|buruan|klaim|poin+\s*reward|cashback\s*\d+%)/i.test(
    text,
  );
}