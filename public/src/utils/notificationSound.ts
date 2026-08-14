export function playNotificationSound(volume: number = 0.5): void {
  try {
    const audio = new Audio('/notify.mp3');
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {}
}
