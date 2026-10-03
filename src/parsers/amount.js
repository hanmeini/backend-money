const UNIT_MULTIPLIER = {
  rb: 1_000,
  ribu: 1_000,
  k: 1_000,
  jt: 1_000_000,
  juta: 1_000_000,
  m: 1_000_000,
};

/**
 * Normalisasi angka format Indonesia menjadi Number.
 * Mendukung: "50.000", "1.234,56", "50rb", "1,5jt", "25000".
 */
export function parseRupiahNumber(token) {
  if (!token) return null;

  let s = String(token).trim().toLowerCase();
  const unitMatch = s.match(/(rb|ribu|jt|juta|k|m)\b/);
  let multiplier = 1;
  if (unitMatch) {
    multiplier = UNIT_MULTIPLIER[unitMatch[1]] ?? 1;
    s = s.replace(/(rb|ribu|jt|juta|k|m)\b/, "");
  }

  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;

  if (s.includes(".") && s.includes(",")) {
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  } else if (s.includes(".")) {
    const parts = s.split(".");
    const isThousandGroups = parts.slice(1).every((p) => p.length === 3);
    if (isThousandGroups) s = parts.join("");
  }

  const value = Number.parseFloat(s);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * multiplier);
}

const SALDO_CONTEXT = /(saldo|sisa|tersedia|sekarang|saat ini)\s*(?:akhir)?\s*$/i;
const PRIMARY_CONTEXT =
  /(sebesar|senilai|sejumlah|nominal|sebanyak|bayar|pembayaran|belanja|pembelian|transfer|top\s*up|topup|isi ulang|tarik|kirim|terima|menerima|masuk|kredit|debit)\s*$/i;

const AMOUNT_REGEX =
  /(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(rb|ribu|jt|juta|k)?\b(?!\s*%)/gi;

/**
 * Ambil nominal transaksi dari teks SMS.
 * Mengabaikan nominal yang merupakan saldo (mis. "saldo sekarang Rp150.000").
 */
export function extractAmount(text) {
  if (!text) return null;

  AMOUNT_REGEX.lastIndex = 0;
  const candidates = [];
  let match;
  while ((match = AMOUNT_REGEX.exec(text)) !== null) {
    const rawToken = match[0];
    const token = [match[1], match[2] ? `,${match[2]}` : "", match[3] ? ` ${match[3]}` : ""].join("");
    const value = parseRupiahNumber(token);
    if (value === null) continue;

    const before = text.slice(Math.max(0, match.index - 20), match.index);
    candidates.push({
      value,
      index: match.index,
      isSaldo: SALDO_CONTEXT.test(before),
      isPrimary: PRIMARY_CONTEXT.test(before),
      hasCurrency: /rp/i.test(rawToken),
    });
  }

  if (candidates.length === 0) return null;

  const primary = candidates.find((c) => c.isPrimary && !c.isSaldo);
  if (primary) return primary.value;

  const nonSaldo = candidates.filter((c) => !c.isSaldo);
  if (nonSaldo.length > 0) {
    const withCurrency = nonSaldo.find((c) => c.hasCurrency);
    return (withCurrency ?? nonSaldo[0]).value;
  }

  return null;
}
