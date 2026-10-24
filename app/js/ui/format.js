// Norwegian formatting of durations and percentages.

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0 min';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} t ${rest} min` : `${hours} t`;
}

export function formatPercent(fraction) {
  const value = Math.max(0, Math.min(1, fraction || 0)) * 100;
  return `${value < 10 && value > 0 ? value.toFixed(1).replace('.', ',') : Math.floor(value)} %`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('nb-NO').format(value);
}
