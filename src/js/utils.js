import { createIcons, icons } from 'lucide';

export function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(dayStr) {
  if (!dayStr) return '';
  const [y, m, d] = dayStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  return dt.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function formatDelta(current, previous, unit = '', decimals = 0) {
  if (current == null || previous == null) return 'Baseline';
  const diff = current - previous;
  const fixed = decimals > 0 ? diff.toFixed(decimals) : Math.round(diff).toString();
  const sign = diff > 0 ? '+' : '';
  return `${sign}${fixed}${unit ? ` ${unit}` : ''} vs prev`;
}

export function formatSourceLabel(source) {
  if (source === 'manual_entry') return 'Manual Entry';
  if (source === 'simulated_live') return 'Simulated Live';
  return 'Simulated Seed';
}

export function getStatusMeta(level) {
  switch (level) {
    case 'HIGH':
      return {
        label: 'HIGH ALERT',
        glyph: '◆',
        textClass: 'status-high',
        boxClass: 'status-box-high',
      };
    case 'MODERATE':
      return {
        label: 'MODERATE WATCH',
        glyph: '▲',
        textClass: 'status-moderate',
        boxClass: 'status-box-moderate',
      };
    default:
      return {
        label: 'NOMINAL',
        glyph: '●',
        textClass: 'status-low',
        boxClass: 'status-box-low',
      };
  }
}

export function refreshIcons() {
  createIcons({ icons });
}

let toastTimer = null;
export function showToast(message, isError = false) {
  const el = document.getElementById('global-toast');
  if (!el) return;
  el.textContent = message;
  el.style.borderColor = isError
    ? 'rgba(244, 63, 94, 0.65)'
    : 'rgba(56, 189, 248, 0.5)';
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('hidden');
  }, 4200);
}
