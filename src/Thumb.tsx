import { useState } from 'react';
import type { Source } from './types';

/** Article image, or a coloured placeholder with the source name if missing/broken. */
export function Thumb({ src, source, className = '' }: { src: string | null; source?: Source; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className={`thumb placeholder ${className}`} style={{ background: source?.color ?? '#555' }}>
        {source?.name ?? ''}
      </div>
    );
  }
  return <img className={`thumb ${className}`} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}
