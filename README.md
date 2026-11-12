# norwegian-news-react — Overblikk

Latest news from **Aftenposten** and **Dagbladet**, built with **React + Vite + TypeScript**: a newspaper-style front page with a featured story ("Hovedsak"), then each article with its picture beside the title and its lead text. Interface in Norwegian (bokmål).

**Live site:** https://enaeimi.github.io/norwegian-news-react/

## Features

- Featured story, then a two-column list (picture · title · lead text)
- Filter by source and category, plus full-text search
- Coloured source badges, relative times ("for 12 minutter siden"), Norwegian dates (Europe/Oslo)
- Placeholder when an article has no image; light and dark themes; mobile layout
- Pagination: 12 articles per page after the featured story
- Reloads the news every 5 minutes

## How it works

Browsers can't read these RSS feeds directly (CORS), so the news is fetched at build time:

1. `.github/workflows/deploy.yml` runs **every 30 minutes**, on every push to `main`, and on demand.
2. `scripts/fetch-news.mjs` reads the RSS feeds and writes `public/news.json`: title, lead text, image, category and date. When an article has no image or lead text, it reads `og:image` / `og:description` from the article page (25 articles at most per source).
3. The app is built and deployed to **GitHub Pages**. If one source fails, the others are still published; if all fail, the job fails and the previous version stays online.

Feeds: `https://www.aftenposten.no/rss`, `https://www.dagbladet.no/?lab_viewport=rss` (each with a fallback feed).

## Setup on GitHub

**Settings → Pages → Source: "GitHub Actions"** (not "Deploy from a branch").

## Local development

```bash
npm install
npm run fetch-news   # writes public/news.json
npm run dev
```

## Limitations

- News is at most ~30 minutes old; GitHub can delay scheduled runs.
- GitHub disables scheduled workflows in public repos after 60 days without activity; re-enable it from the Actions tab.
- The lead text is the one the publisher puts in its feed. Some articles may be behind a paywall on the original site.
- All content belongs to its publishers; every article links back to the original site.
