# backend-money

Backend API untuk **DompetKu** — aplikasi pengelola keuangan otomatis berbasis SMS e-wallet (OVO, GoPay, DANA, ShopeePay).

## Fitur

- Menerima SMS mentah dari aplikasi Android (`POST /api/v1/sms/ingest`)
- Parsing otomatis nominal, arah transaksi (masuk/keluar), dan sumber dana
- CRUD transaksi manual (untuk transaksi tunai)
- Ringkasan dashboard "uang siap pakai"
- Log SMS untuk debugging (`sms_logs`)

## Stack

- Node.js 22 + Fastify 5
- Prisma ORM + MySQL 8

## Struktur

```
src/
  server.js              # bootstrap Fastify
  routes/                # endpoint API
    sms.js               # POST /api/v1/sms/ingest
    transactions.js      # /api/v1/transactions
    dashboard.js         # /api/v1/dashboard
  parsers/               # engine regex e-wallet
    amount.js            # normalisasi nominal Rupiah
    source.js            # deteksi e-wallet & promosi
    direction.js         # deteksi masuk/keluar
    index.js             # orkestrator parseSms()
  lib/                   # prisma, auth, periode, serializer
prisma/schema.prisma     # skema database
test/parser.test.js      # unit test parser
```

## Setup

```bash
npm install
cp .env.example .env      # sesuaikan DATABASE_URL
npx prisma generate
npx prisma db push
npm run dev
```

## Autentikasi (MVP)

Kirim header `x-device-id: <id-unik-hp>`. User dibuat otomatis saat request pertama.

## Contoh Request

```bash
curl -X POST http://localhost:3000/api/v1/sms/ingest \
  -H "Content-Type: application/json" \
  -H "x-device-id: device-123" \
  -d '{"pengirim":"OVO","teks":"OVO: Transaksi Berhasil. Bayar ke Tokopedia sebesar Rp50.000. Saldo OVO sekarang Rp150.000.","timestamp":"2026-10-01T10:00:00+07:00"}'
```

```bash
curl http://localhost:3000/api/v1/dashboard -H "x-device-id: device-123"
```

## Endpoint

| Method | Path | Keterangan |
| ------ | ---- | ---------- |
| GET | `/health` | Health check |
| POST | `/api/v1/sms/ingest` | Terima SMS mentah dari Android |
| POST | `/api/v1/transactions` | Tambah transaksi manual |
| GET | `/api/v1/transactions` | Riwayat (filter `month`, `source`, `type`) |
| GET | `/api/v1/dashboard` | Ringkasan "uang siap pakai" |

## Deployment

Domain backend: `dompetku.hanmeini.my.id` (via reverse proxy HTTPS).
