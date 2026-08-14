import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSharedFile } from '../utils/sharedFile';

export default function ShareTarget() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const cache = await caches.open('shared-files');
        const response = await cache.match('shared-file');
        if (response) {
          const blob = await response.blob();
          const name = decodeURIComponent(response.headers.get('X-File-Name') || 'file');
          const file = new File([blob], name, { type: blob.type });
          setSharedFile(file);
          cache.delete('shared-file');
        }
      } catch {}
      navigate('/', { replace: true });
    })();
  }, [navigate]);

  return null;
}
