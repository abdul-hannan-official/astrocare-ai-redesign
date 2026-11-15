import { renderMonitoringHistoryChart } from '../charts.js';
import {
  escapeHtml,
  formatDateTime,
  formatSourceLabel,
  getStatusMeta,
} from '../utils.js';

export function renderMonitoring(container, state, handlers) {
  const { history, isSimulating, monitoringMetric } = state;

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Simulation Banner & Controls -->
      <div class="astro-panel flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 text-xs text-cyan-300 font-medium">
            <span>SIMULATED TELEMETRY STREAM</span>
            <span aria-hidden="true">·</span>
            <span>SQLITE PERSISTENCE ACTIVE</span>
          </div>
          <h1 class="text-xl font-bold text-slate-50 mt-1">Live Health Monitoring &amp; Manual Entry</h1>
          <p class="text-xs text-slate-400 mt-1">
            All automated demo readings are <strong class="text-cyan-300">SIMULATED</strong> for mission testing. Manual entries are validated, analyzed by the AI Risk Engine, and saved to the backend database.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
          <button type="button" id="mon-toggle-sim-btn" class="astro-btn-secondary ${isSimulating ? 'is-active' : ''}">
            <i data-lucide="${isSimulating ? 'pause' : 'play'}" class="w-4 h-4"></i>
            <span>${isSimulating ? 'Live Demo Running (6s)' : 'Start Live Demo'}</span>
          </button>
          <button type="button" id="mon-sim-now-btn" class="astro-btn-primary">
            <i data-lucide="radio" class="w-4 h-4"></i>
            <span>Generate Simulated Reading</span>
          </button>
        </div>
      </div>

      <!-- Main Split: Manual Entry Form + Historical Chart -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <!-- Manual Entry Form -->
        <div class="astro-panel lg:col-span-5 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-base font-semibold text-slate-100">Manual Vital Reading Entry</h2>
              <span class="text-xs text-slate-400">Saved to Backend</span>
            </div>
            <p class="text-xs text-slate-400 mt-1">Enter readings directly or load a test scenario preset to verify Risk Engine alerts.</p>

            <!-- Quick Judge Test Presets -->
            <div class="flex flex-wrap gap-2 mt-3">
              <button type="button" class="astro-btn-secondary text-xs py-1.5 px-2.5" data-preset="normal">
                Preset: Normal
              </button>
              <button type="button" class="astro-btn-secondary text-xs py-1.5 px-2.5" data-preset="moderate">
                Preset: Moderate Watch
              </button>
              <button type="button" class="astro-btn-secondary text-xs py-1.5 px-2.5" data-preset="high">
                Preset: High Alert
              </button>
            </div>

            <form id="manual-reading-form" class="mt-4 space-y-3" novalidate>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="astro-label" for="input-hr">Heart Rate (bpm)</label>
                  <input id="input-hr" name="heart_rate" type="number" min="30" max="220" step="1" required class="astro-input font-mono-tabular" value="72" />
                </div>
                <div>
                  <label class="astro-label" for="input-spo2">SpO2 (%)</label>
                  <input id="input-spo2" name="spo2" type="number" min="70" max="100" step="0.1" required class="astro-input font-mono-tabular" value="98.1" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="astro-label" for="input-sys">Systolic BP (mmHg)</label>
                  <input id="input-sys" name="systolic_bp" type="number" min="60" max="240" step="1" required class="astro-input font-mono-tabular" value="118" />
                </div>
                <div>
                  <label class="astro-label" for="input-dia">Diastolic BP (mmHg)</label>
                  <input id="input-dia" name="diastolic_bp" type="number" min="40" max="150" step="1" required class="astro-input font-mono-tabular" value="76" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="astro-label" for="input-temp">Body Temp (°C)</label>
                  <input id="input-temp" name="body_temp_c" type="number" min="33.0" max="42.5" step="0.1" required class="astro-input font-mono-tabular" value="36.7" />
                </div>
                <div>
                  <label class="astro-label" for="input-sleep">Sleep Duration (hrs)</label>
                  <input id="input-sleep" name="sleep_hours" type="number" min="0" max="16" step="0.1" required class="astro-input font-mono-tabular" value="7.2" />
                </div>
              </div>

              <div>
                <label class="astro-label" for="input-activity">Activity Level</label>
                <select id="input-activity" name="activity_level" class="astro-select">
                  <option value="Rest">Rest</option>
                  <option value="Light" selected>Light</option>
                  <option value="Moderate">Moderate</option>
                  <option value="EVA Prep">EVA Prep</option>
                  <option value="Exercise">Exercise</option>
                </select>
              </div>

              <div id="manual-form-error" class="hidden p-2.5 rounded-lg status-box-high text-xs text-rose-200" role="alert"></div>

              <button type="submit" id="manual-submit-btn" class="astro-btn-primary w-full mt-2">
                <i data-lucide="save" class="w-4 h-4"></i>
                <span>Save &amp; Analyze Reading</span>
              </button>
            </form>
          </div>
        </div>

        <!-- Historical Vital Chart -->
        <div class="astro-panel lg:col-span-7 flex flex-col justify-between">
          <div>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 class="text-base font-semibold text-slate-100">Historical Telemetry Inspector</h2>
                <p class="text-xs text-slate-400 mt-0.5">Select a vital parameter to inspect recent mission history.</p>
              </div>
              <div class="astro-segmented" role="tablist" aria-label="Select vital metric chart">
                ${[
                  { key: 'heart_rate', label: 'Heart Rate' },
                  { key: 'spo2', label: 'SpO2' },
                  { key: 'blood_pressure', label: 'BP' },
                  { key: 'body_temp_c', label: 'Temp' },
                  { key: 'sleep_hours', label: 'Sleep' },
                ]
                  .map(
                    (tab) => `
                    <button
                      type="button"
                      role="tab"
                      aria-selected="${monitoringMetric === tab.key ? 'true' : 'false'}"
                      class="astro-segment-btn ${monitoringMetric === tab.key ? 'is-active' : ''}"
                      data-metric-tab="${tab.key}"
                    >${tab.label}</button>
                  `,
                  )
                  .join('')}
              </div>
            </div>
            <div class="astro-chart-wrap">
              <canvas id="monitoring-history-canvas" aria-label="Historical telemetry line chart"></canvas>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Showing last ${Math.min(24, history.length)} stored readings</span>
            <span class="font-mono-tabular">Total in view: ${history.length}</span>
          </div>
        </div>
      </div>

      <!-- Readings History Table -->
      <div class="astro-panel">
        <div class="flex items-center justify-between gap-3 mb-3">
          <h2 class="text-base font-semibold text-slate-100">Stored Telemetry Log</h2>
          <span class="text-xs text-slate-400 font-mono-tabular">${history.length} recent records</span>
        </div>

        ${
          history.length === 0
            ? `<p class="text-sm text-slate-400 py-6 text-center">No readings stored yet. Submit a reading above.</p>`
            : `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-800 text-slate-400">
                  <th class="py-2.5 pr-3 font-medium">Timestamp</th>
                  <th class="py-2.5 px-3 font-medium text-right">HR</th>
                  <th class="py-2.5 px-3 font-medium text-right">SpO2</th>
                  <th class="py-2.5 px-3 font-medium text-right">BP</th>
                  <th class="py-2.5 px-3 font-medium text-right">Temp</th>
                  <th class="py-2.5 px-3 font-medium text-right">Sleep</th>
                  <th class="py-2.5 px-3 font-medium">Activity</th>
                  <th class="py-2.5 px-3 font-medium">Source</th>
                  <th class="py-2.5 pl-3 font-medium">Risk Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                ${history
                  .slice(0, 18)
                  .map((r) => {
                    const st = getStatusMeta(r.risk_level);
                    return `
                      <tr class="hover:bg-slate-800/35">
                        <td class="py-2.5 pr-3 font-mono-tabular text-slate-300 whitespace-nowrap">${escapeHtml(formatDateTime(r.recorded_at))}</td>
                        <td class="py-2.5 px-3 font-mono-tabular text-right text-slate-100">${r.heart_rate} bpm</td>
                        <td class="py-2.5 px-3 font-mono-tabular text-right text-slate-100">${r.spo2.toFixed(1)}%</td>
                        <td class="py-2.5 px-3 font-mono-tabular text-right text-slate-100">${r.systolic_bp}/${r.diastolic_bp}</td>
                        <td class="py-2.5 px-3 font-mono-tabular text-right text-slate-100">${r.body_temp_c.toFixed(1)} °C</td>
                        <td class="py-2.5 px-3 font-mono-tabular text-right text-slate-100">${r.sleep_hours.toFixed(1)} h</td>
                        <td class="py-2.5 px-3 text-slate-300 whitespace-nowrap">${escapeHtml(r.activity_level)}</td>
                        <td class="py-2.5 px-3 text-slate-400 whitespace-nowrap">${escapeHtml(formatSourceLabel(r.source))}</td>
                        <td class="py-2.5 pl-3 font-mono-tabular whitespace-nowrap ${st.textClass}">${st.glyph} ${st.label}</td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
      </div>
    </div>
  `;

  container
    .querySelector('#mon-toggle-sim-btn')
    ?.addEventListener('click', handlers.onToggleSimulation);
  container
    .querySelector('#mon-sim-now-btn')
    ?.addEventListener('click', handlers.onSimulateNow);

  container.querySelectorAll('[data-metric-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      handlers.onChangeMonitoringMetric(tab.dataset.metricTab);
    });
  });

  // Preset buttons
  const presets = {
    normal: { hr: 70, spo2: 98.4, sys: 116, dia: 74, temp: 36.7, sleep: 7.4, act: 'Light' },
    moderate: { hr: 105, spo2: 93.6, sys: 136, dia: 86, temp: 37.3, sleep: 5.5, act: 'Rest' },
    high: { hr: 122, spo2: 90.2, sys: 152, dia: 95, temp: 38.3, sleep: 4.2, act: 'Rest' },
  };
  container.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = presets[btn.dataset.preset];
      if (!p) return;
      container.querySelector('#input-hr').value = p.hr;
      container.querySelector('#input-spo2').value = p.spo2;
      container.querySelector('#input-sys').value = p.sys;
      container.querySelector('#input-dia').value = p.dia;
      container.querySelector('#input-temp').value = p.temp;
      container.querySelector('#input-sleep').value = p.sleep;
      container.querySelector('#input-activity').value = p.act;
      const errBox = container.querySelector('#manual-form-error');
      errBox.classList.add('hidden');
    });
  });

  // Form submission
  const form = container.querySelector('#manual-reading-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = container.querySelector('#manual-form-error');
    const submitBtn = container.querySelector('#manual-submit-btn');
    errBox.classList.add('hidden');

    const fd = new FormData(form);
    const requiredNumeric = [
      { key: 'heart_rate', label: 'Heart Rate' },
      { key: 'spo2', label: 'SpO2' },
      { key: 'systolic_bp', label: 'Systolic BP' },
      { key: 'diastolic_bp', label: 'Diastolic BP' },
      { key: 'body_temp_c', label: 'Body Temperature' },
      { key: 'sleep_hours', label: 'Sleep Duration' },
    ];
    for (const field of requiredNumeric) {
      const raw = String(fd.get(field.key) ?? '').trim();
      if (!raw || !Number.isFinite(Number(raw))) {
        errBox.textContent = `Please enter a valid numeric value for ${field.label}.`;
        errBox.classList.remove('hidden');
        return;
      }
    }

    const payload = {
      heart_rate: Number(fd.get('heart_rate')),
      spo2: Number(fd.get('spo2')),
      systolic_bp: Number(fd.get('systolic_bp')),
      diastolic_bp: Number(fd.get('diastolic_bp')),
      body_temp_c: Number(fd.get('body_temp_c')),
      sleep_hours: Number(fd.get('sleep_hours')),
      activity_level: String(fd.get('activity_level')),
      source: 'manual_entry',
    };

    if (payload.diastolic_bp >= payload.systolic_bp) {
      errBox.textContent = 'Diastolic blood pressure must be lower than systolic blood pressure.';
      errBox.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    try {
      await handlers.onSubmitReading(payload);
    } catch (err) {
      errBox.textContent = err.message || 'Unable to save reading.';
      errBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
    }
  });

  const canvas = container.querySelector('#monitoring-history-canvas');
  renderMonitoringHistoryChart(canvas, history, monitoringMetric);
}
