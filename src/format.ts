const timeFmt = new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Oslo' });
const dayFmt = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Oslo' });
const relFmt = new Intl.RelativeTimeFormat('nb', { numeric: 'auto' });

export const formatDate = (iso: string | null) => (iso ? timeFmt.format(new Date(iso)) : '');
export const today = () => dayFmt.format(new Date());

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (minutes > -1) return 'akkurat nå'; // also covers slightly future dates (clock skew)
  if (Math.abs(minutes) < 60) return relFmt.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relFmt.format(hours, 'hour');
  return relFmt.format(Math.round(hours / 24), 'day');
}

/** Most frequent categories, for the filter chips. */
export function topCategories(categories: (string | null)[], max = 8): string[] {
  const counts = new Map<string, number>();
  for (const c of categories) if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([c]) => c);
}
