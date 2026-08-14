function triggerDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

function getName(url: string, fileName?: string): string {
  const name = fileName || url.split('/').pop()?.split('?')[0] || 'download';
  const ext = url.split('/').pop()?.split('?')[0]?.split('.').pop() || '';
  return name.includes('.') ? name : `${name}.${ext}`;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('4send_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function downloadFile(url: string, fileName?: string): Promise<void> {
  const name = getName(url, fileName);

  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('Direct fetch failed');
    triggerDownload(await res.blob(), name);
    return;
  } catch {}

  try {
    const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Proxy failed');
    triggerDownload(await res.blob(), name);
    return;
  } catch {}
}
