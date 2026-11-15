import Chart from 'chart.js/auto';
import { formatShortDate, formatTime } from './utils.js';

const chartRegistry = new Map();

function createOrReplaceChart(canvasId, canvasEl, config) {
  if (!canvasEl) return null;
  const existing = chartRegistry.get(canvasId);
  if (existing) {
    existing.destroy();
    chartRegistry.delete(canvasId);
  }
  const instance = new Chart(canvasEl, config);
  chartRegistry.set(canvasId, instance);
  return instance;
}

const BASE_GRID_COLOR = 'rgba(148, 163, 184, 0.12)';
const BASE_TICK_COLOR = '#94a3b8';

function commonScales(yTitle) {
  return {
    x: {
      grid: { color: BASE_GRID_COLOR },
      ticks: { color: BASE_TICK_COLOR, maxTicksLimit: 8, font: { family: 'Fira Code', size: 11 } },
    },
    y: {
      grid: { color: BASE_GRID_COLOR },
      ticks: { color: BASE_TICK_COLOR, font: { family: 'Fira Code', size: 11 } },
      title: yTitle
        ? { display: true, text: yTitle, color: '#cbd5e1', font: { size: 11 } }
        : undefined,
    },
  };
}

export function renderDashboardTrendChart(canvasEl, readings) {
  const ordered = [...readings].slice(0, 16).reverse();
  const labels = ordered.map((r) => formatTime(r.recorded_at));

  return createOrReplaceChart('dashboard-trend', canvasEl, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Heart Rate (bpm)',
          data: ordered.map((r) => r.heart_rate),
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.14)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
          yAxisID: 'y',
        },
        {
          label: 'SpO2 (%)',
          data: ordered.map((r) => r.spo2),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.12)',
          borderWidth: 2,
          borderDash: [5, 4],
          tension: 0.3,
          pointRadius: 3,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#cbd5e1', font: { family: 'Fira Sans', size: 12 } },
        },
      },
      scales: {
        x: {
          grid: { color: BASE_GRID_COLOR },
          ticks: { color: BASE_TICK_COLOR, font: { family: 'Fira Code', size: 11 } },
        },
        y: {
          type: 'linear',
          position: 'left',
          suggestedMin: 50,
          suggestedMax: 135,
          grid: { color: BASE_GRID_COLOR },
          ticks: { color: '#67e8f9', font: { family: 'Fira Code', size: 11 } },
          title: { display: true, text: 'BPM', color: '#67e8f9', font: { size: 11 } },
        },
        y1: {
          type: 'linear',
          position: 'right',
          min: 86,
          max: 100,
          grid: { drawOnChartArea: false },
          ticks: { color: '#93c5fd', font: { family: 'Fira Code', size: 11 } },
          title: { display: true, text: 'SpO2 %', color: '#93c5fd', font: { size: 11 } },
        },
      },
    },
  });
}

export function renderMonitoringHistoryChart(canvasEl, readings, metricKey) {
  const ordered = [...readings].slice(0, 24).reverse();
  const labels = ordered.map((r) => formatTime(r.recorded_at));

  let datasets = [];
  let yTitle = '';

  if (metricKey === 'blood_pressure') {
    yTitle = 'mmHg';
    datasets = [
      {
        label: 'Systolic (mmHg)',
        data: ordered.map((r) => r.systolic_bp),
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.14)',
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 3,
      },
      {
        label: 'Diastolic (mmHg)',
        data: ordered.map((r) => r.diastolic_bp),
        borderColor: '#818cf8',
        borderWidth: 2,
        borderDash: [4, 4],
        tension: 0.25,
        pointRadius: 3,
      },
    ];
  } else {
    const metaMap = {
      heart_rate: { label: 'Heart Rate (bpm)', unit: 'bpm', color: '#06b6d4', fill: 'rgba(6, 182, 212, 0.16)' },
      spo2: { label: 'SpO2 (%)', unit: '%', color: '#3b82f6', fill: 'rgba(59, 130, 246, 0.16)' },
      body_temp_c: { label: 'Body Temperature (°C)', unit: '°C', color: '#f59e0b', fill: 'rgba(245, 158, 11, 0.14)' },
      sleep_hours: { label: 'Sleep Duration (hrs)', unit: 'hrs', color: '#a78bfa', fill: 'rgba(167, 139, 250, 0.16)' },
    };
    const m = metaMap[metricKey] || metaMap.heart_rate;
    yTitle = m.unit;
    datasets = [
      {
        label: m.label,
        data: ordered.map((r) => r[metricKey]),
        borderColor: m.color,
        backgroundColor: m.fill,
        fill: true,
        borderWidth: 2,
        tension: 0.28,
        pointRadius: 3.5,
      },
    ];
  }

  return createOrReplaceChart('monitoring-history', canvasEl, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#cbd5e1', font: { size: 12 } } },
      },
      scales: commonScales(yTitle),
    },
  });
}

export function renderAnalytics24hChart(canvasEl, readings24h) {
  const labels = readings24h.map((r) => formatTime(r.recorded_at));
  return createOrReplaceChart('analytics-24h', canvasEl, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Heart Rate (bpm)',
          data: readings24h.map((r) => r.heart_rate),
          borderColor: '#06b6d4',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 2.5,
        },
        {
          label: 'Systolic BP (mmHg)',
          data: readings24h.map((r) => r.systolic_bp),
          borderColor: '#3b82f6',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 2.5,
        },
        {
          label: 'SpO2 (%)',
          data: readings24h.map((r) => r.spo2),
          borderColor: '#34d399',
          borderWidth: 2,
          borderDash: [4, 4],
          tension: 0.3,
          pointRadius: 2.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#cbd5e1', font: { size: 12 } } },
      },
      scales: commonScales('Value'),
    },
  });
}

export function renderAnalytics7dChart(canvasEl, daily7d) {
  const labels = daily7d.map((d) => formatShortDate(d.day));
  return createOrReplaceChart('analytics-7d', canvasEl, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '7-Day Avg Heart Rate (bpm)',
          data: daily7d.map((d) => d.avg_hr),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.14)',
          fill: true,
          borderWidth: 2,
          tension: 0.3,
        },
        {
          label: '7-Day Avg SpO2 (%)',
          data: daily7d.map((d) => d.avg_spo2),
          borderColor: '#34d399',
          borderWidth: 2,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#cbd5e1', font: { size: 12 } } },
      },
      scales: commonScales('Daily Average'),
    },
  });
}

export function renderSleepChart(canvasEl, daily7d, sleepTarget = 6.0) {
  const labels = daily7d.map((d) => formatShortDate(d.day));
  return createOrReplaceChart('analytics-sleep', canvasEl, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Daily Avg Sleep (hrs)',
          data: daily7d.map((d) => d.avg_sleep),
          backgroundColor: daily7d.map((d) =>
            d.avg_sleep < sleepTarget ? 'rgba(245, 158, 11, 0.65)' : 'rgba(59, 130, 246, 0.65)',
          ),
          borderColor: daily7d.map((d) => (d.avg_sleep < sleepTarget ? '#fbbf24' : '#60a5fa')),
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#cbd5e1', font: { size: 12 } } },
      },
      scales: {
        ...commonScales('Hours'),
        y: {
          ...commonScales('Hours').y,
          min: 0,
          max: 10,
        },
      },
    },
  });
}

export function renderAlertHistoryChart(canvasEl, alertTimeline) {
  const labels = alertTimeline.map((d) => formatShortDate(d.day));
  return createOrReplaceChart('analytics-alerts', canvasEl, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'HIGH Alerts',
          data: alertTimeline.map((d) => d.high),
          backgroundColor: 'rgba(244, 63, 94, 0.72)',
          borderRadius: 4,
        },
        {
          label: 'MODERATE Alerts',
          data: alertTimeline.map((d) => d.moderate),
          backgroundColor: 'rgba(245, 158, 11, 0.72)',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#cbd5e1', font: { size: 12 } } },
      },
      scales: {
        x: { ...commonScales().x, stacked: true },
        y: {
          ...commonScales('Alert Count').y,
          stacked: true,
          ticks: { ...commonScales().y.ticks, stepSize: 1 },
        },
      },
    },
  });
}
