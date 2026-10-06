import { prisma } from "../lib/prisma.js";
import { findOrCreateUser } from "../lib/auth.js";
import { getMonthPeriod } from "../lib/period.js";
import { serializeTransaction } from "../lib/serialize.js";

const VALID_TYPES = new Set(["INCOME", "EXPENSE"]);
const VALID_SOURCES = new Set(["CASH", "OVO", "GOPAY", "DANA", "SHOPEEPAY", "OTHER"]);

export default async function transactionRoutes(app) {
  app.post("/api/v1/transactions", async (req, reply) => {
    const user = await findOrCreateUser(req);
    if (!user) {
      return reply.code(401).send({ error: "Header x-device-id wajib diisi" });
    }

    const body = req.body ?? {};
    const amount = Number(body.amount);
    const type = String(body.type ?? "").toUpperCase();
    const source = String(body.source ?? "OTHER").toUpperCase();
    const note = body.note ? String(body.note).slice(0, 255) : null;
    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();

    if (!Number.isInteger(amount) || amount <= 0) {
      return reply.code(422).send({ error: "Field 'amount' harus bilangan bulat positif" });
    }
    if (!VALID_TYPES.has(type)) {
      return reply.code(422).send({ error: "Field 'type' harus INCOME atau EXPENSE" });
    }
    if (!VALID_SOURCES.has(source)) {
      return reply.code(422).send({ error: "Field 'source' tidak valid" });
    }
    if (Number.isNaN(occurredAt.getTime())) {
      return reply.code(422).send({ error: "Field 'occurredAt' bukan tanggal valid" });
    }

    const transaction = await prisma.transaction.create({
      data: { userId: user.id, amount, type, source, note, occurredAt },
    });

    return reply.code(201).send({ transaction: serializeTransaction(transaction) });
  });

  app.put("/api/v1/transactions/:id", async (req, reply) => {
    const user = await findOrCreateUser(req);
    if (!user) {
      return reply.code(401).send({ error: "Header x-device-id wajib diisi" });
    }

    const id = Number(req.params?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(404).send({ error: "Transaksi tidak ditemukan" });
    }

    const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return reply.code(404).send({ error: "Transaksi tidak ditemukan" });
    }

    const body = req.body ?? {};
    const data = {};

    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isInteger(amount) || amount <= 0) {
        return reply.code(422).send({ error: "Field 'amount' harus bilangan bulat positif" });
      }
      data.amount = amount;
    }
    if (body.type !== undefined) {
      const type = String(body.type).toUpperCase();
      if (!VALID_TYPES.has(type)) {
        return reply.code(422).send({ error: "Field 'type' harus INCOME atau EXPENSE" });
      }
      data.type = type;
    }
    if (body.source !== undefined) {
      const source = String(body.source).toUpperCase();
      if (!VALID_SOURCES.has(source)) {
        return reply.code(422).send({ error: "Field 'source' tidak valid" });
      }
      data.source = source;
    }
    if (body.note !== undefined) {
      const note = body.note ? String(body.note).slice(0, 255) : null;
      data.note = note;
    }
    if (body.occurredAt !== undefined) {
      const occurredAt = new Date(body.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) {
        return reply.code(422).send({ error: "Field 'occurredAt' bukan tanggal valid" });
      }
      data.occurredAt = occurredAt;
    }

    const transaction = await prisma.transaction.update({ where: { id }, data });
    return reply.send({ transaction: serializeTransaction(transaction) });
  });

  app.delete("/api/v1/transactions/:id", async (req, reply) => {
    const user = await findOrCreateUser(req);
    if (!user) {
      return reply.code(401).send({ error: "Header x-device-id wajib diisi" });
    }

    const id = Number(req.params?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(404).send({ error: "Transaksi tidak ditemukan" });
    }

    const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return reply.code(404).send({ error: "Transaksi tidak ditemukan" });
    }

    await prisma.transaction.delete({ where: { id } });
    return reply.send({ deleted: true, id });
  });

  app.get("/api/v1/transactions", async (req, reply) => {
    const user = await findOrCreateUser(req);
    if (!user) {
      return reply.code(401).send({ error: "User tidak ditemukan" });
    }

    const { month, source, type } = req.query ?? {};
    const limit = Math.min(Math.max(Number(req.query?.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query?.offset) || 0, 0);

    const where = { userId: user.id };

    if (month) {
      const period = getMonthPeriod(month);
      where.occurredAt = { gte: period.start, lt: period.end };
    }
    if (source) {
      const normalized = String(source).toUpperCase();
      if (!VALID_SOURCES.has(normalized)) {
        return reply.code(422).send({ error: "Filter 'source' tidak valid" });
      }
      where.source = normalized;
    }
    if (type) {
      const normalized = String(type).toUpperCase();
      if (!VALID_TYPES.has(normalized)) {
        return reply.code(422).send({ error: "Filter 'type' tidak valid" });
      }
      where.type = normalized;
    }

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where }),
    ]);

    return reply.send({
      total,
      limit,
      offset,
      items: items.map(serializeTransaction),
    });
  });
}