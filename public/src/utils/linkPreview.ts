const API_BASE = import.meta.env.VITE_API_URL ?? 'https://4send-messenger.hf.space';

export interface LinkPreview {
  title: string;
  description: string;
  image: string;
  url: string;
}

const cache = new Map<string, LinkPreview | null>();

export const fetchLinkPreview = async (url: string): Promise<LinkPreview | null> => {
  if (cache.has(url)) return cache.get(url) ?? null;
  try {
    const token = localStorage.getItem('4send_token');
    const res = await fetch(
      `${API_BASE}/api/link-preview?url=${encodeURIComponent(url)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      cache.set(url, null);
      return null;
    }
    const data = await res.json();
    if (data.error) {
      cache.set(url, null);
      return null;
    }
    const preview: LinkPreview = {
      title: data.title || '',
      description: data.description || '',
      image: data.image || '',
      url: data.url || url,
    };
    cache.set(url, preview);
    return preview;
  } catch {
    cache.set(url, null);
    return null;
  }
};
