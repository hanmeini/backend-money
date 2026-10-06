import { prisma } from "../lib/prisma.js";
import { findOrCreateUser } from "../lib/auth.js";
import { getMonthPeriod, remainingDaysInMonth } from "../lib/period.js";
import { serializeTransaction } from "../lib/serialize.js";

export default async function dashboardRoutes(app) {
  app.get("/api/v1/dashboard", async (req, reply) => {
    const user = await findOrCreateUser(req);
    if (!user) {
      return reply.code(401).send({ error: "Akses ditolak" });
    }

    const period = getMonthPeriod(req.query?.month);
    const range = { gte: period.start, lt: period.end };

    const [grouped, latest] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["type"],
        where: { userId: user.id, occurredAt: range },
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { occurredAt: "desc" },
        take: 5,
      }),
    ]);

    const sumByType = Object.fromEntries(grouped.map((g) => [g.type, g._sum.amount ?? 0]));
    const totalMasuk = sumByType.INCOME ?? 0;
    const totalKeluar = sumByType.EXPENSE ?? 0;
    const sisaUangAman = totalMasuk - totalKeluar;

    const sisaHari = remainingDaysInMonth(period);
    const amanPerHari = Math.floor(Math.max(sisaUangAman, 0) / sisaHari);

    return reply.send({
      periode: period.label,
      sisaUangAman,
      totalMasuk,
      totalKeluar,
      sisaHari,
      amanPerHari,
      transaksiTerakhir: latest.map(serializeTransaction),
    });
  });
}