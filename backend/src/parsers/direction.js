const INCOME_PATTERNS = [
  /transfer\s+(?:dari|masuk)/i,
  /(?:top\s*up|topup|isi ulang)/i,
  /\b(?:menerima|terima|diterima)\b/i,
  /\b(?:pengembalian|refund|cashback)\b/i,
  /\b(?:dana|uang)\s+masuk\b/i,
  /\b(?:masuk|bertambah|kredit)\b/i,
];

const EXPENSE_PATTERNS = [
  /transfer\s+ke/i,
  /\b(?:bayar|pembayaran|membayar)\b/i,
  /\b(?:belanja|pembelian|membeli)\b/i,
  /\b(?:tarik|penarikan|ditarik)\b/i,
  /\b(?:kirim|mengirim)\b/i,
  /\b(?:debit|pengeluaran|keluar)\b/i,
];

function firstMatchIndex(patterns, text) {
  let best = -1;
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && (best === -1 || match.index < best)) best = match.index;
  }
  return best;
}

/**
 * Tentukan arah transaksi (INCOME/EXPENSE) berdasarkan kata kunci
 * yang paling awal muncul pada teks SMS.
 */
export function detectDirection(text) {
  if (!text) return null;
  const incomeAt = firstMatchIndex(INCOME_PATTERNS, text);
  const expenseAt = firstMatchIndex(EXPENSE_PATTERNS, text);

  if (incomeAt === -1 && expenseAt === -1) return null;
  if (incomeAt === -1) return "EXPENSE";
  if (expenseAt === -1) return "INCOME";
  return incomeAt <= expenseAt ? "INCOME" : "EXPENSE";
}