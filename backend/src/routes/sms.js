import { parseSms } from "../parsers/index.js";
import { prisma } from "../lib/prisma.js";
import { findOrCreateUser } from "../lib/auth.js";
import { isRateLimited } from "../lib/ratelimit.js";
import { serializeTransaction } from "../lib/serialize.js";

export default async function smsRoutes(app) {
  app.post("/api/v1/sms/ingest", async (req, reply) => {
    const user = await findOrCreateUser(req);
    if (!user) {
      return reply.code(401).send({ error: "Akses ditolak" });
    }

    const deviceId = req.headers["x-device-id"];
    if (isRateLimited(`ingest:${deviceId}`, 60, 60_000)) {
      return reply.code(429).send({ error: "Terlalu banyak request, coba lagi nanti" });
    }

    const { pengirim, teks, timestamp } = req.body ?? {};
    const result = parseSms({ pengirim, teks, timestamp });

    if (result.status === "PROCESSED") {
      const duplicate = await prisma.transaction.findFirst({
        where: {
          userId: user.id,
          rawText: result.rawText,
          occurredAt: result.occurredAt,
        },
      });

      if (duplicate) {
        const log = await prisma.smsLog.create({
          data: {
            userId: user.id,
            sender: result.sender || null,
            rawText: result.rawText,
            status: "IGNORED",
            reason: "Duplikat SMS",
            transactionId: duplicate.id,
          },
        });
        return reply.code(200).send({
          status: "IGNORED",
          reason: "Duplikat SMS",
          transaction: serializeTransaction(duplicate),
          logId: log.id,
        });
      }

      const { transaction, log } = await prisma.$transaction(async (tx) => {
        const created = await tx.transaction.create({
          data: {
            userId: user.id,
            type: result.transaction.type,
            source: result.transaction.source,
            amount: result.transaction.amount,
            note: result.transaction.note,
            rawText: result.rawText,
            occurredAt: result.occurredAt,
          },
        });
        const createdLog = await tx.smsLog.create({
          data: {
            userId: user.id,
            sender: result.sender || null,
            rawText: result.rawText,
            status: "PROCESSED",
            transactionId: created.id,
          },
        });
        return { transaction: created, log: createdLog };
      });

      return reply.code(201).send({
        status: "PROCESSED",
        transaction: serializeTransaction(transaction),
        logId: log.id,
      });
    }

    const log = await prisma.smsLog.create({
      data: {
        userId: user.id,
        sender: result.sender || null,
        rawText: result.rawText || "",
        status: result.status,
        reason: result.reason,
      },
    });

    return reply.code(200).send({
      status: result.status,
      reason: result.reason,
      logId: log.id,
    });
  });
}