#!/usr/bin/env node
// Fetches the latest articles (title, lead text, image) from Norwegian news RSS feeds and writes public/news.json.
// Usage: node scripts/fetch-news.mjs <source> [source...]   e.g. `nrk vg`
// Runs in GitHub Actions before each build (browsers cannot read these feeds directly because of CORS).
import { XMLParser } from 'fast-xml-parser';
import { mkdir, writeFile } from 'node:fs/promises';

const MAX_PER_SOURCE = 40;
const ENRICH_LIMIT = 25; // max article pages fetched per source to find a missing image/summary
const SUMMARY_MAX = 320;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const OUT_DIR = new URL('../public/', import.meta.url);

const SOURCES = {
  nrk: {
    name: 'NRK',
    homepage: 'https://www.nrk.no',
    color: '#1b4b8f',
    feeds: ['https://www.nrk.no/toppsaker.rss', 'https://www.nrk.no/nyheter/siste.rss'],
  },
  vg: {
    name: 'VG',
    homepage: 'https://www.vg.no',
    color: '#d6001c',
    feeds: ['https://www.vg.no/rss/feed', 'https://www.vg.no/rss/feed/?format=rss'],
  },
  aftenposten: {
    name: 'Aftenposten',
    homepage: 'https://www.aftenposten.no',
    color: '#0f3e5c',
    feeds: ['https://www.aftenposten.no/rss', 'https://www.aftenposten.no/rss/'],
  },
  dagbladet: {
    name: 'Dagbladet',
    homepage: 'https://www.dagbladet.no',
    color: '#c4161c',
    feeds: ['https://www.dagbladet.no/?lab_viewport=rss', 'https://www.dagbladet.no/rss'],
  },
};

// ---------- helpers ----------
async function get(url, timeout = 20_000) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/html;q=0.9, */*;q=0.8', 'accept-language': 'nb-NO,nb;q=0.9,no;q=0.8,en;q=0.5' },
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const ENTITIES = { ndash: '–', mdash: '—', euro: '€', bull: '•', middot: '·', rdquo: '”', ldquo: '“', ouml: 'ö', auml: 'ä', uuml: 'ü', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»', hellip: '…', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê', aring: 'å', Aring: 'Å', oslash: 'ø', Oslash: 'Ø', aelig: 'æ', AElig: 'Æ' };
const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? ENTITIES[n.toLowerCase()] ?? m);
const clean = (s) => decode(decode(String(s ?? '').replace(/<[^>]*>/g, ' '))).replace(/\s+/g, ' ').trim();
const text = (v) => (v == null ? '' : typeof v === 'object' ? String(v['#text'] ?? '') : String(v));
const arr = (v) => (v == null ? [] : [].concat(v));
const toIso = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
};
function truncate(s, max = SUMMARY_MAX) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '…';
}
const isImage = (m) => m?.['@_url'] && (!m['@_type'] || String(m['@_type']).startsWith('image') || m['@_medium'] === 'image');

function pickImage(it) {
  // media:content / media:group (choose the widest), then media:thumbnail, enclosure, then <img> in the HTML.
  const media = [...arr(it['media:content']), ...arr(it['media:group']?.['media:content'])].filter(isImage);
  media.sort((a, b) => Number(b['@_width'] ?? 0) - Number(a['@_width'] ?? 0));
  const candidate =
    media[0]?.['@_url'] ??
    arr(it['media:thumbnail'])[0]?.['@_url'] ??
    arr(it.enclosure).find(isImage)?.['@_url'] ??
    /<img[^>]+src=["']([^"']+)["']/i.exec(text(it['content:encoded']) + text(it.description))?.[1];
  return candidate ? decode(candidate) : null;
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', processEntities: true });

function parseFeed(body, sourceId) {
  const doc = xml.parse(body);
  const raw = arr(doc?.rss?.channel?.item ?? doc?.feed?.entry);
  if (!raw.length) throw new Error('feed has no items');
  return raw.map((it) => {
    const link = arr(it.link).map((l) => (typeof l === 'object' ? l['@_href'] ?? text(l) : l)).find(Boolean) ?? text(it.guid);
    return {
      source: sourceId,
      title: clean(text(it.title)),
      link: String(link ?? '').trim(),
      summary: truncate(clean(text(it.description ?? it.summary))),
      published: toIso(text(it.pubDate ?? it.published ?? it.updated ?? it['dc:date'])),
      image: pickImage(it),
      category: clean(text(arr(it.category)[0])) || null,
    };
  });
}

// Reads og:image / og:description from the article page when the feed lacks them.
function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
  const tag = re.exec(html)?.[0];
  const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
  return content ? decode(content).trim() : null;
}
async function enrich(items) {
  const todo = items.filter((i) => !i.image || !i.summary).slice(0, ENRICH_LIMIT);
  let fixed = 0;
  for (let k = 0; k < todo.length; k += 5) {
    await Promise.all(
      todo.slice(k, k + 5).map(async (item) => {
        try {
          const html = await get(item.link, 10_000);
          const img = meta(html, 'og:image');
          const desc = meta(html, 'og:description') ?? meta(html, 'description');
          if (!item.image && img) { item.image = new URL(img, item.link).toString(); fixed++; }
          if (!item.summary && desc) item.summary = truncate(clean(desc));
        } catch { /* keep the item without image/summary */ }
      }),
    );
  }
  return fixed;
}

async function fetchSource(id) {
  const src = SOURCES[id];
  const errors = [];
  for (const feed of src.feeds) {
    try {
      const items = parseFeed(await get(feed), id)
        .filter((i) => i.title && i.link)
        .slice(0, MAX_PER_SOURCE);
      const fixed = await enrich(items);
      const withImg = items.filter((i) => i.image).length;
      const withSum = items.filter((i) => i.summary).length;
      console.log(`${id}: ${items.length} items from ${feed} (images ${withImg}, summaries ${withSum}, ${fixed} images from article pages)`);
      return items;
    } catch (err) {
      errors.push(err.message);
      console.warn(`${id}: feed failed: ${err.message}`);
    }
  }
  throw new Error(`${id}: all feeds failed (${errors.join('; ')})`);
}

// ---------- main ----------
const ids = process.argv.slice(2);
const unknown = ids.filter((id) => !SOURCES[id]);
if (!ids.length || unknown.length) {
  console.error(`Usage: fetch-news.mjs <${Object.keys(SOURCES).join('|')}> [...]${unknown.length ? ` (unknown: ${unknown})` : ''}`);
  process.exit(2);
}

const results = await Promise.allSettled(ids.map(fetchSource));
const ok = ids.filter((_, k) => results[k].status === 'fulfilled');
results.filter((r) => r.status === 'rejected').forEach((r) => console.error(r.reason.message));
if (!ok.length) process.exit(1); // keep the previously deployed site online

const seen = new Set();
const items = results
  .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  .filter((i) => !seen.has(i.link) && seen.add(i.link))
  .sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''));

const payload = {
  sources: ok.map((id) => ({ id, name: SOURCES[id].name, homepage: SOURCES[id].homepage, color: SOURCES[id].color })),
  fetchedAt: new Date().toISOString(),
  items,
};
await mkdir(OUT_DIR, { recursive: true });
await writeFile(new URL('news.json', OUT_DIR), JSON.stringify(payload, null, 2));
console.log(`Wrote ${items.length} items (${ok.join(', ')})`);
