import { useState, useEffect, useCallback } from 'react';
import { fetchLinkPreview, type LinkPreview } from '../../utils/linkPreview';
import styles from './LinkPreviewCard.module.css';

interface LinkPreviewCardProps {
  url: string;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export default function LinkPreviewCard({ url }: LinkPreviewCardProps) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setPreview(null);
    setImgError(false);
    fetchLinkPreview(url).then(p => {
      if (cancelled) return;
      setPreview(p);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [url]);

  const handleClick = useCallback(() => {
    const target = preview?.url || url;
    window.open(target, '_blank', 'noopener,noreferrer');
  }, [preview, url]);

  if (!loaded || !preview || (!preview.title && !preview.description && (!preview.image || imgError))) {
    return null;
  }

  const showImage = !!preview.image && !imgError;

  return (
    <button className={styles.card} onClick={handleClick}>
      {showImage && (
        <img
          src={preview.image}
          className={styles.image}
          onError={() => setImgError(true)}
          alt=""
        />
      )}
      <div className={styles.info}>
        {preview.title && <div className={styles.title}>{preview.title}</div>}
        {preview.description && <div className={styles.desc}>{preview.description}</div>}
        <div className={styles.domain}>{extractDomain(preview.url || url)}</div>
      </div>
    </button>
  );
}
