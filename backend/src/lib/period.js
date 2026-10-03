const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function toWib(date) {
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

function fromWibParts(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day) - WIB_OFFSET_MS);
}

/**
 * Rentang waktu [start, end) untuk satu bulan pada zona WIB (UTC+7).
 * monthStr format "YYYY-MM"; default bulan berjalan di WIB.
 */
export function getMonthPeriod(monthStr) {
  let year;
  let month;

  if (typeof monthStr === "string" && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [y, m] = monthStr.split("-").map(Number);
    year = y;
    month = m;
  } else {
    const nowWib = toWib(new Date());
    year = nowWib.getUTCFullYear();
    month = nowWib.getUTCMonth() + 1;
  }

  const start = fromWibParts(year, month, 1);
  const end = fromWibParts(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1);

  return {
    year,
    month,
    label: `${year}-${String(month).padStart(2, "0")}`,
    start,
    end,
  };
}

/**
 * Sisa hari (termasuk hari ini) sampai akhir bulan pada zona WIB.
 */
export function remainingDaysInMonth(period) {
  const nowWib = toWib(new Date());
  const endWib = toWib(period.end);
  const lastDay = new Date(Date.UTC(endWib.getUTCFullYear(), endWib.getUTCMonth(), 0)).getUTCDate();
  const currentDay = Math.min(nowWib.getUTCDate(), lastDay);
  return Math.max(1, lastDay - currentDay + 1);
}