// Durations, percentages and numbers in the interface language.

import { intlLocale, t } from '../i18n.js';

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return t('duration.minutes', { minutes: 0 });
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return t('duration.underMinute');
  if (minutes < 60) return t('duration.minutes', { minutes });
  return t('duration.hours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

// Below 10 % with one decimal; never rounded up to 100 % before the end.
export function formatPercent(fraction) {
  const value = Math.max(0, Math.min(1, fraction || 0)) * 100;
  const shown = value < 10 && value > 0 ? formatNumber(value, 1) : formatNumber(Math.floor(value));
  return t('percent', { value: shown });
}

const numberFormats = new Map();

export function formatNumber(value, decimals = 0) {
  const key = `${intlLocale()}:${decimals}`;
  if (!numberFormats.has(key)) {
    numberFormats.set(key, new Intl.NumberFormat(intlLocale(), {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }));
  }
  return numberFormats.get(key).format(value);
}
