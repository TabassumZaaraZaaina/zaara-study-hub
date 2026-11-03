import type { ISODate } from '@/types';

export const APP_TZ = 'Asia/Dhaka';

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** Local calendar date in Asia/Dhaka for an instant. */
export function localDate(now: Date = new Date()): ISODate {
  return ymdFormatter.format(now); // en-CA gives YYYY-MM-DD
}

export function localHour(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: APP_TZ, hour: '2-digit', hour12: false }).format(now);
  return Number(h) % 24;
}

/** Parse YYYY-MM-DD to a UTC-midnight Date (calendar arithmetic only). */
function toUTC(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function fromUTC(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function isValidISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = toUTC(s);
  return !Number.isNaN(d.getTime()) && fromUTC(d) === s;
}

export function addDays(d: ISODate, n: number): ISODate {
  const x = toUTC(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTC(x);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(d: ISODate): number {
  return toUTC(d).getUTCDay();
}

export function dateRange(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Week starts on Sunday (Bangladesh school week runs Sun–Thu). */
export function startOfWeek(d: ISODate): ISODate {
  return addDays(d, -weekday(d));
}

export function startOfMonth(d: ISODate): ISODate {
  return d.slice(0, 8) + '01';
}

export function addMonths(d: ISODate, n: number): ISODate {
  const x = toUTC(startOfMonth(d));
  x.setUTCMonth(x.getUTCMonth() + n);
  return fromUTC(x);
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const weekdayShort = (d: ISODate) => WD[weekday(d)];
export const weekdayLong = (d: ISODate) => WD_LONG[weekday(d)];
export const WEEKDAY_NAMES = WD_LONG;

export function fmtShort(d: ISODate): string {
  const [, m, day] = d.split('-').map(Number);
  return `${WD[weekday(d)]} ${day} ${MON[m - 1]}`;
}

export function fmtLong(d: ISODate): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${WD_LONG[weekday(d)]}, ${day} ${MON_LONG[m - 1]} ${y}`;
}

export function fmtMonth(d: ISODate): string {
  const [y, m] = d.split('-').map(Number);
  return `${MON_LONG[m - 1]} ${y}`;
}

export function fmtDayMonth(d: ISODate): string {
  const [, m, day] = d.split('-').map(Number);
  return `${day} ${MON[m - 1]}`;
}

/** Relative description relative to `today`. */
export function relativeDay(d: ISODate, today: ISODate): string {
  const n = diffDays(today, d);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n > 1) return `in ${n} days`;
  return `${-n} days ago`;
}

export function greeting(now: Date = new Date()): string {
  const h = localHour(now);
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function fmtMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export const nowISO = () => new Date().toISOString();
