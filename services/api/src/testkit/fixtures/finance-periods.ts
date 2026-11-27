// Calendar anchors around today, for cases that care which budget period a row lands in.
const now = new Date();
const day = (year: number, month: number, date: number) =>
  new Date(Date.UTC(year, month, date)).toISOString().slice(0, 10);
const year = now.getUTCFullYear();
const month = now.getUTCMonth();

export const currentMonthStart = day(year, month, 1);
export const currentMonthEnd = day(year, month + 1, 0);
export const previousMonthDay = day(year, month, 0);
export const nextMonthStart = day(year, month + 1, 1);
export const currentYearStart = day(year, 0, 1);
export const previousYearDay = day(year - 1, 11, 31);
export const currentYearEnd = day(year, 11, 31);

const quarterMonth = Math.floor(month / 3) * 3;
export const currentQuarterStart = day(year, quarterMonth, 1);
export const currentQuarterEnd = day(year, quarterMonth + 3, 0);
