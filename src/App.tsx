import { useMemo, useState } from 'react';
import { formatDate, timeAgo, today, topCategories } from './format';
import { Thumb } from './Thumb';
import type { Article, Source } from './types';
import { useNews } from './useNews';

function Kicker({ item, source }: { item: Article; source?: Source }) {
  return (
    <div className="kicker">
      {source && (
        <span className="badge" style={{ background: source.color }}>
          {source.name}
        </span>
      )}
      {item.category && <span className="cat">{item.category}</span>}
      {item.published && (
        <time dateTime={item.published} title={formatDate(item.published)}>
          {timeAgo(item.published)}
        </time>
      )}
    </div>
  );
}

export default function App() {
  const { feed, error, loading, reload } = useNews();
  const [source, setSource] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const sources = useMemo(() => new Map((feed?.sources ?? []).map((s) => [s.id, s])), [feed]);
  const bySource = useMemo(() => (feed?.items ?? []).filter((i) => !source || i.source === source), [feed, source]);
  const categories = useMemo(() => topCategories(bySource.map((i) => i.category)), [bySource]);

  const items = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('nb');
    return bySource.filter(
      (i) =>
        (!category || i.category === category) &&
        (!q || i.title.toLocaleLowerCase('nb').includes(q) || i.summary.toLocaleLowerCase('nb').includes(q)),
    );
  }, [bySource, category, query]);

  // The most recent article with an image is the featured story ("Hovedsak").
  const hero = items.find((i) => i.image) ?? items[0];
  const rest = items.filter((i) => i !== hero);

  return (
    <div className="page">
      <header className="masthead">
        <div className="dateline">
          <span>{today()}</span>
          <span>{feed ? `Oppdatert ${timeAgo(feed.fetchedAt)}` : 'Laster…'}</span>
        </div>
        <h1>
          Overblikk<span>.</span>
        </h1>
        <p className="tagline">Det viktigste fra Aftenposten og Dagbladet – på ett sted</p>
      </header>

      <div className="toolbar">
        <div className="chips">
          <button className={`chip ${!source ? 'active' : ''}`} onClick={() => { setSource(null); setCategory(null); }}>
            Alle kilder
          </button>
          {feed?.sources.map((s) => (
            <button key={s.id} className={`chip ${source === s.id ? 'active' : ''}`} onClick={() => { setSource(s.id); setCategory(null); }}>
              <span className="dot" style={{ background: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
        <input className="search" type="search" placeholder="Søk…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="refresh" onClick={reload} disabled={loading} title="Oppdater">
          ↻
        </button>
      </div>

      {categories.length > 1 && (
        <div className="toolbar" style={{ position: 'static' }}>
          <div className="chips">
            <button className={`chip ${!category ? 'active' : ''}`} onClick={() => setCategory(null)}>
              Alle kategorier
            </button>
            {categories.map((c) => (
              <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {!feed && loading && [0, 1, 2].map((k) => <div key={k} className="skeleton" />)}
      {!feed && error && (
        <p className="error">
          Kunne ikke laste nyhetene ({error}). Lokalt: kjør først <code>npm run fetch-news</code>.
        </p>
      )}

      {hero && (
        <a className="hero" href={hero.link} target="_blank" rel="noopener noreferrer">
          <Thumb src={hero.image} source={sources.get(hero.source)} />
          <div>
            <span className="label">Hovedsak</span>
            <Kicker item={hero} source={sources.get(hero.source)} />
            <h2>{hero.title}</h2>
            {hero.summary && <p>{hero.summary}</p>}
          </div>
        </a>
      )}

      <section className="grid">
        {rest.map((item) => (
          <a key={item.link} className="story" href={item.link} target="_blank" rel="noopener noreferrer">
            <div className="media">
              <Thumb src={item.image} source={sources.get(item.source)} />
            </div>
            <div>
              <Kicker item={item} source={sources.get(item.source)} />
              <h3>{item.title}</h3>
              {item.summary && <p>{item.summary}</p>}
            </div>
          </a>
        ))}
      </section>

      {feed && items.length === 0 && <p className="empty">Ingen artikler samsvarer med søket ditt.</p>}

      <footer>
        Kilder:{' '}
        {feed?.sources.map((s, k) => (
          <span key={s.id}>
            {k > 0 && ' · '}
            <a href={s.homepage}>{s.name}</a>
          </span>
        ))}
        . Innholdet tilhører de respektive mediehusene; hver artikkel lenker til originalsiden.
      </footer>
    </div>
  );
}
