import { cloudifyDisplay, cloudifyLightbox } from '../../utils/media';
import styles from './MessageImageGrid.module.css';

interface Props {
  urls: string[];
  onOpenLightbox?: (url: string) => void;
}

export default function MessageImageGrid({ urls, onOpenLightbox }: Props) {
  const count = urls.length;

  const gridClass = count === 2
    ? styles.grid2
    : count === 3
      ? styles.grid3
      : count === 4
        ? styles.grid4
        : styles.gridMany;

  return (
    <div className={`${styles.grid} ${gridClass}`}>
      {urls.map((url, idx) => {
        const displayUrl = cloudifyDisplay(url, 600);
        const lightboxUrl = cloudifyLightbox(url);
        let imgClass = styles.cell;
        let spanFirst = false;

        if (count === 3 && idx === 0) {
          imgClass = styles.cell3First;
          spanFirst = true;
        }

        return (
          <img
            key={idx}
            src={displayUrl}
            loading="lazy"
            decoding="async"
            className={imgClass}
            style={spanFirst ? { gridColumn: 'span 2' } : undefined}
            onClick={() => onOpenLightbox?.(lightboxUrl)}
            alt=""
          />
        );
      })}
    </div>
  );
}
