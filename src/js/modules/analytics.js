import {
  renderAlertHistoryChart,
  renderAnalytics24hChart,
  renderAnalytics7dChart,
  renderSleepChart,
} from '../charts.js';

export function renderAnalytics(container, state) {
  const { analytics, thresholds } = state;

  if (!analytics) {
    container.innerHTML = `
      <div class="astro-panel text-center py-10">
        <p class="text-sm text-slate-300">Analytics data is loading or unavailable.</p>
      </div>
    `;
    return;
  }

  const s = analytics.summary;
  const ac = analytics.alertCounts;
  const sleepTarget = thresholds?.sleep_mod_min ?? 6.0;

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header & CSV Download -->
      <div class="astro-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p class="text-xs text-cyan-300 font-medium">SIMULATED MISSION ANALYTICS</p>
          <h1 class="text-xl font-bold text-slate-50 mt-0.5">Health Analytics &amp; Exportable Reports</h1>
          <p class="text-xs text-slate-400 mt-1">Aggregated 24-hour vital trends, 7-day longitudinal averages, sleep tracking, and alert history.</p>
        </div>
        <a
          href="/api/analytics/export.csv"
          download="astrocare-alex-morgan-telemetry.csv"
          class="astro-btn-primary no-underline"
        >
          <i data-lucide="download" class="w-4 h-4"></i>
          <span>Download CSV Report</span>
        </a>
      </div>

      <!-- Summary KPIs -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="astro-panel">
          <div class="text-xs text-slate-400">24h Avg Heart Rate</div>
          <div class="text-2xl font-bold text-slate-50 font-mono-tabular mt-1">
            ${s.avg24hHr} <span class="text-xs font-normal text-slate-400">bpm</span>
          </div>
        </div>
        <div class="astro-panel">
          <div class="text-xs text-slate-400">24h Avg SpO2</div>
          <div class="text-2xl font-bold text-slate-50 font-mono-tabular mt-1">
            ${s.avg24hSpo2.toFixed(1)} <span class="text-xs font-normal text-slate-400">%</span>
          </div>
        </div>
        <div class="astro-panel">
          <div class="text-xs text-slate-400">7-Day Avg Sleep</div>
          <div class="text-2xl font-bold text-slate-50 font-mono-tabular mt-1">
            ${s.avg7dSleep.toFixed(1)} <span class="text-xs font-normal text-slate-400">hrs</span>
          </div>
          <div class="text-xs font-mono-tabular text-slate-400 mt-1">
            Latest delta: ${s.sleepDeltaVs7d >= 0 ? '+' : ''}${s.sleepDeltaVs7d.toFixed(1)} hrs
          </div>
        </div>
        <div class="astro-panel">
          <div class="text-xs text-slate-400">Alert Breakdown</div>
          <div class="text-2xl font-bold text-slate-50 font-mono-tabular mt-1">
            ${ac.total} <span class="text-xs font-normal text-slate-400">total (${ac.unacknowledged} open)</span>
          </div>
          <div class="text-xs font-mono-tabular text-slate-400 mt-1">
            HIGH: ${ac.high} · MODERATE: ${ac.moderate}
          </div>
        </div>
      </div>

      <!-- 4 Interactive Charts Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div class="astro-panel">
          <h2 class="text-base font-semibold text-slate-100">24-Hour Vital Trends</h2>
          <p class="text-xs text-slate-400 mt-0.5 mb-3">Heart rate, systolic BP, and SpO2 over the last 24 hours.</p>
          <div class="astro-chart-wrap-sm">
            <canvas id="analytics-24h-canvas" aria-label="24-hour vital trends chart"></canvas>
          </div>
        </div>

        <div class="astro-panel">
          <h2 class="text-base font-semibold text-slate-100">7-Day Health History</h2>
          <p class="text-xs text-slate-400 mt-0.5 mb-3">Daily average resting &amp; active heart rate and SpO2 across 7 days.</p>
          <div class="astro-chart-wrap-sm">
            <canvas id="analytics-7d-canvas" aria-label="7-day health history chart"></canvas>
          </div>
        </div>

        <div class="astro-panel">
          <h2 class="text-base font-semibold text-slate-100">Sleep Duration Analytics (7 Days)</h2>
          <p class="text-xs text-slate-400 mt-0.5 mb-3">Amber bars indicate days below the ${sleepTarget.toFixed(1)} hr demonstration rest target.</p>
          <div class="astro-chart-wrap-sm">
            <canvas id="analytics-sleep-canvas" aria-label="7-day sleep analytics chart"></canvas>
          </div>
        </div>

        <div class="astro-panel">
          <h2 class="text-base font-semibold text-slate-100">Alert History Timeline</h2>
          <p class="text-xs text-slate-400 mt-0.5 mb-3">Daily distribution of HIGH and MODERATE monitoring alerts.</p>
          <div class="astro-chart-wrap-sm">
            <canvas id="analytics-alerts-canvas" aria-label="Alert history chart"></canvas>
          </div>
        </div>
      </div>
    </div>
  `;

  renderAnalytics24hChart(
    container.querySelector('#analytics-24h-canvas'),
    analytics.readings24h,
  );
  renderAnalytics7dChart(
    container.querySelector('#analytics-7d-canvas'),
    analytics.daily7d,
  );
  renderSleepChart(
    container.querySelector('#analytics-sleep-canvas'),
    analytics.daily7d,
    sleepTarget,
  );
  renderAlertHistoryChart(
    container.querySelector('#analytics-alerts-canvas'),
    analytics.alertTimeline,
  );
}
