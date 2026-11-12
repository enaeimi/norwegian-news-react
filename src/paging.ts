export interface PagerLabels {
  prev: string;
  next: string;
  nav: string;
  /** Formats a page number (e.g. Persian digits). */
  num: (n: number) => string;
}

/** Pages to show around the current one; `null` is an ellipsis. e.g. 1 … 4 5 6 … 9 */
export function pageList(current: number, total: number): (number | null)[] {
  const wanted = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out: (number | null)[] = [];
  let prev = 0;
  for (const p of wanted) {
    if (p - prev === 2) out.push(p - 1); // fill a single gap instead of showing "…"
    else if (p - prev > 2) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}

export const pageCount = (items: number, size: number) => Math.max(1, Math.ceil(items / size));
