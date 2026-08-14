const NAME_COLORS = ['#ff4d4d', '#4caf50', '#ffeb3b', '#2196f3', '#a74fff', '#ff9800', '#00bcd4', '#e91e63'];

export const getSenderColor = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower === '4send_system' || lower === '4send_help') return '#ffa726';
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length] ?? '#a74fff';
};
