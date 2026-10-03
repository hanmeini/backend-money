import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSms } from "../src/parsers/index.js";
import { parseRupiahNumber } from "../src/parsers/amount.js";

test("parseRupiahNumber mendukung format Indonesia", () => {
  assert.equal(parseRupiahNumber("50.000"), 50000);
  assert.equal(parseRupiahNumber("1.234,56"), 1235);
  assert.equal(parseRupiahNumber("50rb"), 50000);
  assert.equal(parseRupiahNumber("1,5jt"), 1500000);
  assert.equal(parseRupiahNumber("25000"), 25000);
});

test("OVO pengeluaran", () => {
  const result = parseSms({
    pengirim: "OVO",
    teks: "OVO: Transaksi Berhasil. Bayar ke Tokopedia sebesar Rp50.000. Saldo OVO sekarang Rp150.000.",
    timestamp: "2026-10-01T10:00:00+07:00",
  });
  assert.equal(result.status, "PROCESSED");
  assert.equal(result.transaction.source, "OVO");
  assert.equal(result.transaction.type, "EXPENSE");
  assert.equal(result.transaction.amount, 50000);
});

test("GoPay pengeluaran ambil nominal transaksi bukan saldo", () => {
  const result = parseSms({
    pengirim: "GoPay",
    teks: "GoPay: Pembayaran Rp25.000 ke Gojek berhasil. Sisa saldo Rp75.000.",
  });
  assert.equal(result.status, "PROCESSED");
  assert.equal(result.transaction.type, "EXPENSE");
  assert.equal(result.transaction.amount, 25000);
});

test("DANA pemasukan (top up)", () => {
  const result = parseSms({
    pengirim: "DANA",
    teks: "DANA: Top Up sebesar Rp100.000 berhasil. Saldo DANA kamu Rp180.000.",
  });
  assert.equal(result.status, "PROCESSED");
  assert.equal(result.transaction.type, "INCOME");
  assert.equal(result.transaction.amount, 100000);
});

test("ShopeePay transfer masuk", () => {
  const result = parseSms({
    pengirim: "ShopeePay",
    teks: "ShopeePay: Kamu menerima transfer dari Budi sebesar Rp15.000. Saldo kamu Rp35.000.",
  });
  assert.equal(result.status, "PROCESSED");
  assert.equal(result.transaction.type, "INCOME");
  assert.equal(result.transaction.amount, 15000);
});

test("SMS promosi diabaikan", () => {
  const result = parseSms({
    pengirim: "OVO",
    teks: "OVO: Promo diskon 50% untuk transaksi pertamamu! Buruan klaim vouchernya.",
  });
  assert.equal(result.status, "IGNORED");
});

test("pengirim tidak dikenal diabaikan", () => {
  const result = parseSms({ pengirim: "PROMO123", teks: "Dapatkan hadiah Rp1.000.000" });
  assert.equal(result.status, "IGNORED");
});

test("nominal tidak ditemukan -> FAILED", () => {
  const result = parseSms({ pengirim: "DANA", teks: "DANA: Transaksi berhasil diproses." });
  assert.equal(result.status, "FAILED");
});