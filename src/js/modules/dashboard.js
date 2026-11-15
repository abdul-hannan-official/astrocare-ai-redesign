import astronautPortraitUrl from '../../assets/images/astronaut_portrait_morgan_1794659617239.jpg';
import { renderDashboardTrendChart } from '../charts.js';
import {
  escapeHtml,
  formatDateTime,
  formatDelta,
  formatSourceLabel,
  getStatusMeta,
} from '../utils.js';

export function renderDashboard(container, state, handlers) {
  const { currentState, history, isSimulating } = state;
  const profile = currentState?.profile;
  const current = currentState?.current;
  const previous = currentState?.previous;
  const analysis = currentState?.analysis;
  const unack = currentState?.unacknowledgedCount ?? 0;

  if (!profile || !current) {
    container.innerHTML = `
      <div class="astro-panel text-center py-10">
        <p class="text-base font-semibold text-slate-100">No Telemetry Recorded Yet</p>
        <p class="text-sm text-slate-400 mt-1">Log an initial reading or simulate a sample to populate the mission dashboard.</p>
        <div class="mt-4 flex justify-center gap-3">
          <button type="button" class="astro-btn-primary" data-dash-simulate>Simulate Reading</button>
          <button type="button" class="astro-btn-secondary" data-dash-goto="monitoring">Open Manual Entry</button>
        </div>
      </div>
    `;
    container.querySelector('[data-dash-simulate]')?.addEventListener('click', handlers.onSimulateNow);
    container.querySelector('[data-dash-goto]')?.addEventListener('click', () => handlers.onNavigate('monitoring'));
    return;
  }

  const missionPct = Math.min(
    100,
    Math.round((profile.mission_day / profile.mission_duration_days) * 100),
  );
  const statusMeta = getStatusMeta(analysis?.level || current.risk_level);
  const th = state.thresholds || currentState?.thresholds || {
    heart_rate_high_mod: 100,
    heart_rate_high_crit: 118,
    spo2_mod_min: 94,
    spo2_high_min: 91,
    systolic_mod_high: 135,
    systolic_crit_high: 150,
    diastolic_mod_high: 88,
    diastolic_crit_high: 96,
    temp_mod_high: 37.5,
    temp_crit_high: 38.2,
    sleep_mod_min: 6.0,
  };
  const isExertion =
    current.activity_level === 'Exercise' || current.activity_level === 'EVA Prep';
  const hrModHigh = th.heart_rate_high_mod + (isExertion ? 25 : 0);
  const hrCritHigh = th.heart_rate_high_crit + (isExertion ? 25 : 0);

  const metrics = [
    {
      label: 'Heart Rate',
      value: `${current.heart_rate}`,
      unit: 'bpm',
      delta: formatDelta(current.heart_rate, previous?.heart_rate, 'bpm'),
      status:
        current.heart_rate >= hrCritHigh
          ? 'HIGH'
          : current.heart_rate >= hrModHigh || current.heart_rate <= 48
            ? 'MODERATE'
            : 'LOW',
      target: `Demo range: 48–${hrModHigh} bpm (${isExertion ? current.activity_level : 'rest'})`,
    },
    {
      label: 'Blood Oxygen (SpO2)',
      value: `${current.spo2.toFixed(1)}`,
      unit: '%',
      delta: formatDelta(current.spo2, previous?.spo2, '%', 1),
      status:
        current.spo2 <= th.spo2_high_min
          ? 'HIGH'
          : current.spo2 <= th.spo2_mod_min
            ? 'MODERATE'
            : 'LOW',
      target: `Demo target: > ${th.spo2_mod_min.toFixed(1)}%`,
    },
    {
      label: 'Blood Pressure',
      value: `${current.systolic_bp}/${current.diastolic_bp}`,
      unit: 'mmHg',
      delta: previous
        ? `${current.systolic_bp - previous.systolic_bp >= 0 ? '+' : ''}${current.systolic_bp - previous.systolic_bp} sys vs prev`
        : 'Baseline',
      status:
        current.systolic_bp >= th.systolic_crit_high ||
        current.diastolic_bp >= th.diastolic_crit_high
          ? 'HIGH'
          : current.systolic_bp >= th.systolic_mod_high ||
              current.diastolic_bp >= th.diastolic_mod_high ||
              current.systolic_bp <= 90
            ? 'MODERATE'
            : 'LOW',
      target: `Demo range: 90–${th.systolic_mod_high} / < ${th.diastolic_mod_high} mmHg`,
    },
    {
      label: 'Body Temperature',
      value: `${current.body_temp_c.toFixed(1)}`,
      unit: '°C',
      delta: formatDelta(current.body_temp_c, previous?.body_temp_c, '°C', 1),
      status:
        current.body_temp_c >= th.temp_crit_high
          ? 'HIGH'
          : current.body_temp_c >= th.temp_mod_high || current.body_temp_c <= 35.8
            ? 'MODERATE'
            : 'LOW',
      target: `Demo range: 35.8–${th.temp_mod_high.toFixed(1)} °C`,
    },
    {
      label: 'Sleep Duration',
      value: `${current.sleep_hours.toFixed(1)}`,
      unit: 'hrs',
      delta: formatDelta(current.sleep_hours, previous?.sleep_hours, 'hrs', 1),
      status:
        current.sleep_hours <= 4.5
          ? 'HIGH'
          : current.sleep_hours <= th.sleep_mod_min
            ? 'MODERATE'
            : 'LOW',
      target: `Demo target: >= ${th.sleep_mod_min.toFixed(1)} hrs`,
    },
    {
      label: 'Activity Level',
      value: escapeHtml(current.activity_level),
      unit: '',
      delta: formatSourceLabel(current.source),
      status: 'LOW',
      target: 'Contextualizes HR thresholds',
    },
  ];

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Top Row: Astronaut Profile & Overall Mission Health Status -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <!-- Astronaut Profile Card -->
        <div class="astro-panel lg:col-span-7 flex flex-col justify-between gap-4 relative overflow-hidden">
          <div class="flex flex-col sm:flex-row sm:items-center gap-4">
            <div class="relative w-20 h-20 rounded-xl overflow-hidden border border-cyan-400/25 bg-slate-900 shrink-0">
              <img
                src="${astronautPortraitUrl}"
                alt="Astronaut Alex Morgan portrait"
                referrerpolicy="no-referrer"
                class="w-full h-full object-cover"
                onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');"
              />
              <div class="hidden w-full h-full flex items-center justify-center bg-slate-800 text-cyan-300 font-semibold text-lg">
                AM
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2 text-xs text-cyan-300 font-medium">
                <span>SIMULATED CREW PROFILE</span>
                <span aria-hidden="true">·</span>
                <span class="font-mono-tabular">${escapeHtml(profile.callsign)}</span>
              </div>
              <h1 class="text-2xl font-bold text-slate-50 tracking-tight mt-0.5">${escapeHtml(profile.name)}</h1>
              <p class="text-sm text-slate-300 mt-0.5">${escapeHtml(profile.role)}</p>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-2">
                <span>${escapeHtml(profile.mission_name)}</span>
                <span aria-hidden="true">·</span>
                <span>${escapeHtml(profile.habitat_module)}</span>
              </div>
            </div>
          </div>

          <hr class="astro-divider my-0" />

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <div class="text-xs text-slate-400">Mission Day</div>
              <div class="text-lg font-semibold text-slate-100 font-mono-tabular mt-0.5">
                Day ${profile.mission_day} <span class="text-xs text-slate-400 font-normal">/ ${profile.mission_duration_days}</span>
              </div>
            </div>
            <div>
              <div class="text-xs text-slate-400">Mission Duration</div>
              <div class="text-lg font-semibold text-slate-100 font-mono-tabular mt-0.5">
                ${profile.mission_duration_days} days <span class="text-xs text-cyan-300 font-normal">(${missionPct}%)</span>
              </div>
            </div>
            <div>
              <div class="text-xs text-slate-400">Progress Timeline</div>
              <div class="w-full h-2 rounded-full bg-slate-800 mt-2 overflow-hidden">
                <div class="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style="width: ${missionPct}%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Overall Health Overview Panel -->
        <div class="astro-panel lg:col-span-5 flex flex-col justify-between gap-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs text-slate-400">Overall Health Overview</p>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-lg font-bold ${statusMeta.textClass} font-mono-tabular">
                  ${statusMeta.glyph} ${statusMeta.label}
                </span>
              </div>
            </div>
            <div class="text-right">
              <div class="text-xs text-slate-400">Last Updated</div>
              <div class="text-xs text-slate-200 font-mono-tabular mt-0.5">${escapeHtml(formatDateTime(current.recorded_at))}</div>
            </div>
          </div>

          <div class="p-3.5 rounded-lg ${statusMeta.boxClass}">
            <p class="text-sm font-medium text-slate-100">${escapeHtml(analysis?.title || 'Telemetry Summary')}</p>
            <p class="text-xs text-slate-300 mt-1 leading-relaxed">${escapeHtml(analysis?.summary || current.risk_summary)}</p>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div class="text-xs text-slate-400">
              Telemetry source: <span class="text-cyan-300 font-medium">${escapeHtml(formatSourceLabel(current.source).toUpperCase())}</span>
              <span aria-hidden="true">·</span>
              <span>Unacknowledged alerts: <strong class="text-slate-100 font-mono-tabular">${unack}</strong></span>
            </div>
            <button type="button" class="astro-btn-secondary text-xs" data-dash-goto="risk-alerts">
              Review Risk &amp; Alerts
            </button>
          </div>
        </div>
      </div>

      <!-- 6 Vital Signs KPI Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${metrics
          .map((m) => {
            const st = getStatusMeta(m.status);
            return `
              <article class="astro-panel flex flex-col justify-between gap-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-medium text-slate-400">${m.label}</span>
                  <span class="text-xs font-mono-tabular ${st.textClass}">${st.glyph} ${st.label}</span>
                </div>
                <div class="flex items-baseline gap-1.5">
                  <span class="text-3xl font-bold text-slate-50 font-mono-tabular">${m.value}</span>
                  ${m.unit ? `<span class="text-xs text-slate-400 font-mono-tabular uppercase">${m.unit}</span>` : ''}
                </div>
                <div class="flex items-center justify-between gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                  <span class="font-mono-tabular text-slate-300">${escapeHtml(m.delta)}</span>
                  <span>${escapeHtml(m.target)}</span>
                </div>
              </article>
            `;
          })
          .join('')}
      </div>

      <!-- 24-Hour Telemetry Trend & Live Simulation Controls -->
      <div class="astro-panel">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="text-base font-semibold text-slate-100">24-Hour Vital Telemetry Trend (Simulated)</h2>
            <p class="text-xs text-slate-400 mt-0.5">Heart rate and SpO2 trajectories stored in local SQLite telemetry log.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" id="dash-toggle-sim-btn" class="astro-btn-secondary ${isSimulating ? 'is-active' : ''}">
              <i data-lucide="${isSimulating ? 'pause' : 'play'}" class="w-4 h-4"></i>
              <span>${isSimulating ? 'Pause Live Demo' : 'Start Live Demo'}</span>
            </button>
            <button type="button" id="dash-sim-now-btn" class="astro-btn-secondary">
              <i data-lucide="activity" class="w-4 h-4"></i>
              <span>Simulate Reading</span>
            </button>
            <button type="button" class="astro-btn-primary" data-dash-goto="assistant">
              <i data-lucide="message-square" class="w-4 h-4"></i>
              <span>Ask AI Assistant</span>
            </button>
          </div>
        </div>
        <div class="astro-chart-wrap">
          <canvas id="dashboard-trend-canvas" aria-label="24-hour heart rate and SpO2 telemetry chart"></canvas>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-dash-goto]').forEach((btn) => {
    btn.addEventListener('click', () => handlers.onNavigate(btn.dataset.dashGoto));
  });
  container
    .querySelector('#dash-toggle-sim-btn')
    ?.addEventListener('click', handlers.onToggleSimulation);
  container
    .querySelector('#dash-sim-now-btn')
    ?.addEventListener('click', handlers.onSimulateNow);

  const canvas = container.querySelector('#dashboard-trend-canvas');
  renderDashboardTrendChart(canvas, history);
}
