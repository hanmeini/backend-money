import { extractAmount } from "./amount.js";
import { detectSource, isPromotional } from "./source.js";
import { detectDirection } from "./direction.js";

function parseTimestamp(timestamp) {
  if (timestamp === undefined || timestamp === null) return new Date();

  const raw = String(timestamp).trim();
  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    const ms = raw.length <= 10 ? numeric * 1000 : numeric;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildNote(text) {
  return text.replace(/^\s*[A-Za-z][A-Za-z\s-]*:\s*/, "").slice(0, 255);
}

/**
 * Parse satu SMS e-wallet mentah menjadi transaksi terstruktur.
 * Mengembalikan objek dengan status PROCESSED | IGNORED | FAILED.
 */
export function parseSms({ pengirim, teks, timestamp } = {}) {
  const sender = (pengirim ?? "").trim();
  const text = (teks ?? "").trim();
  const occurredAt = parseTimestamp(timestamp);
  const base = { sender, rawText: text, occurredAt };

  if (!text) {
    return { ...base, status: "FAILED", reason: "Teks SMS kosong" };
  }

  const source = detectSource(sender, text);
  if (!source) {
    return { ...base, status: "IGNORED", reason: "Pengirim bukan e-wallet yang dikenali" };
  }

  if (isPromotional(text)) {
    return { ...base, status: "IGNORED", reason: "SMS terdeteksi sebagai promosi" };
  }

  const amount = extractAmount(text);
  if (!amount || amount <= 0) {
    return { ...base, status: "FAILED", reason: "Nominal transaksi tidak ditemukan" };
  }

  const type = detectDirection(text);
  if (!type) {
    return { ...base, status: "FAILED", reason: "Arah transaksi tidak terdeteksi" };
  }

  return {
    ...base,
    status: "PROCESSED",
    transaction: {
      source,
      type,
      amount,
      note: buildNote(text),
    },
  };
}
