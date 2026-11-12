import { pageList, type PagerLabels } from './paging';

export function Pager({ page, total, labels, onChange }: { page: number; total: number; labels: PagerLabels; onChange: (page: number) => void }) {
  if (total <= 1) return null;
  return (
    <nav className="pager" aria-label={labels.nav}>
      <button className="pager-step" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        {labels.prev}
      </button>
      {pageList(page, total).map((p, k) =>
        p === null ? (
          <span key={`gap${k}`} className="pager-gap">…</span>
        ) : (
          <button key={p} className={`pager-num ${p === page ? 'active' : ''}`} aria-current={p === page ? 'page' : undefined} onClick={() => onChange(p)}>
            {labels.num(p)}
          </button>
        ),
      )}
      <button className="pager-step" disabled={page >= total} onClick={() => onChange(page + 1)}>
        {labels.next}
      </button>
    </nav>
  );
}
