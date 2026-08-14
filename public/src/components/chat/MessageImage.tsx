import { cloudifyDisplay, cloudifyLightbox } from '../../utils/media';
import styles from './MessageImage.module.css';

interface Props {
  src: string;
  isSticker?: boolean;
  isGif?: boolean;
  onOpenLightbox?: (url: string) => void;
}

export default function MessageImage({ src, isSticker, isGif, onOpenLightbox }: Props) {
  const displayUrl = cloudifyDisplay(src, 800);
  const lightboxUrl = cloudifyLightbox(src);

  const handleClick = () => onOpenLightbox?.(lightboxUrl);

  return (
    <img
      src={displayUrl}
      loading="lazy"
      decoding="async"
      data-is-sticker={isSticker}
      data-is-gif={isGif}
      className={`${styles.image} ${isSticker ? styles.sticker : ''}`}
      onClick={handleClick}
      alt=""
    />
  );
}
