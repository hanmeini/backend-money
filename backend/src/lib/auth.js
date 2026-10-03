import { prisma } from "./prisma.js";

function readDeviceId(req) {
  const deviceId = req.headers["x-device-id"];
  return typeof deviceId === "string" && deviceId.trim() ? deviceId.trim() : null;
}

/**
 * Cari user berdasarkan header x-device-id. Tidak membuat user baru.
 */
export async function findUser(req) {
  const deviceId = readDeviceId(req);
  if (deviceId) {
    return prisma.user.findUnique({ where: { deviceId } });
  }

  const rawUserId = req.headers["x-user-id"];
  const userId = Number(rawUserId);
  if (Number.isInteger(userId) && userId > 0) {
    return prisma.user.findUnique({ where: { id: userId } });
  }

  return null;
}

/**
 * Cari user berdasarkan x-device-id, buat otomatis bila belum ada.
 */
export async function findOrCreateUser(req) {
  const deviceId = readDeviceId(req);
  if (deviceId) {
    return prisma.user.upsert({
      where: { deviceId },
      update: {},
      create: { deviceId },
    });
  }

  return findUser(req);
}