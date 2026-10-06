import { prisma } from "./prisma.js";

function readDeviceId(req) {
  const deviceId = req.headers["x-device-id"];
  return typeof deviceId === "string" && deviceId.trim() ? deviceId.trim() : null;
}

function readDeviceToken(req) {
  const token = req.headers["x-device-token"];
  return typeof token === "string" && token.trim() ? token.trim() : null;
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
 * Bila user sudah mengklaim token rahasia, request wajib menyertakan
 * x-device-token yang sama, kalau tidak user dianggap tidak dikenali.
 */
export async function findOrCreateUser(req) {
  const deviceId = readDeviceId(req);
  if (!deviceId) {
    return findUser(req);
  }

  const token = readDeviceToken(req);
  const user = await prisma.user.findUnique({ where: { deviceId } });

  if (!user) {
    return prisma.user.create({ data: { deviceId, deviceToken: token } });
  }

  if (user.deviceToken) {
    if (!token || token !== user.deviceToken) return null;
    return user;
  }

  if (token) {
    return prisma.user.update({ where: { id: user.id }, data: { deviceToken: token } });
  }

  return user;
}