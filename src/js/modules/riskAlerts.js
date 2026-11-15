import { escapeHtml, formatDateTime, getStatusMeta } from '../utils.js';

export function renderRiskAlerts(container, state, handlers) {
  const { currentState, alerts, alertFilter, thresholds } = state;
  const analysis = currentState?.analysis;
  const activeThresholds = thresholds || currentState?.thresholds;

  const filteredAlerts = alerts.filter((a) => {
    if (alertFilter === 'unacknowledged') return !a.acknowledged;
    if (alertFilter === 'HIGH') return a.severity === 'HIGH';
    if (alertFilter === 'MODERATE') return a.severity === 'MODERATE';
    return true;
  });

  const statusMeta = getStatusMeta(analysis?.level || 'LOW');
  const limitations = analysis?.limitations || [
    'Static demonstration ranges do not account for individual astronaut baselines, age, or mission-phase adaptation.',
    'Microgravity fluid shifts and circadian misalignment naturally alter cardiovascular and sleep metrics over time.',
    'Motion artifacts, loose pulse-oximeter contact, or cabin environmental shifts can cause transient non-clinical readings.',
    'Not a clinically validated medical device; all alerts require verification and human medical officer oversight.',
  ];

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Explainable AI Risk Engine Panel -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div class="astro-panel lg:col-span-7 flex flex-col justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xs text-cyan-300 font-medium">EXPLAINABLE AI HEALTH RISK ENGINE</p>
                <h1 class="text-xl font-bold text-slate-50 mt-0.5">Current Telemetry Risk Assessment</h1>
              </div>
              <span class="text-sm font-bold font-mono-tabular ${statusMeta.textClass}">
                ${statusMeta.glyph} ${statusMeta.label}
              </span>
            </div>

            <!-- Test Scenarios Bar (Normal, Moderate, High) -->
            <div class="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs text-slate-400">Run Alert Test Scenario:</span>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="astro-btn-secondary text-xs py-1.5 px-2.5" data-risk-scenario="normal">
                  Test Normal (LOW)
                </button>
                <button type="button" class="astro-btn-secondary text-xs py-1.5 px-2.5" data-risk-scenario="moderate">
                  Test Moderate Watch
                </button>
                <button type="button" class="astro-btn-secondary text-xs py-1.5 px-2.5" data-risk-scenario="high">
                  Test High Alert
                </button>
              </div>
            </div>

            <div class="mt-4 p-4 rounded-lg ${statusMeta.boxClass}">
              <p class="text-sm font-semibold text-slate-100">${escapeHtml(analysis?.title || 'No Active Assessment')}</p>
              <p class="text-xs text-slate-300 mt-1 leading-relaxed">${escapeHtml(analysis?.summary || '')}</p>
            </div>

            <!-- Triggering Measurements -->
            <div class="mt-4">
              <h2 class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Detected Indicators &amp; Explainable Rules</h2>
              ${
                !analysis || analysis.triggeredFactors.length === 0
                  ? `<p class="text-xs text-slate-400 mt-2 p-3 astro-surface-muted">All 5 monitored domains (Heart Rate, SpO2, Blood Pressure, Temperature, Sleep Pattern) are within configured demonstration thresholds.</p>`
                  : `
                  <div class="mt-2 space-y-2.5">
                    ${analysis.triggeredFactors
                      .map((f) => {
                        const fm = getStatusMeta(f.severity);
                        return `
                          <div class="p-3.5 astro-surface-muted space-y-1.5">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                              <span class="text-sm font-semibold text-slate-100">Indicator: ${escapeHtml(f.label)}</span>
                              <span class="text-xs font-mono-tabular ${fm.textClass}">${fm.glyph} ${escapeHtml(f.severity)}</span>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs font-mono-tabular">
                              <div class="text-slate-300">
                                <span class="text-slate-400">Measured:</span> <span class="text-cyan-200">${escapeHtml(f.observed)}</span>
                              </div>
                              <div class="text-slate-300">
                                <span class="text-slate-400">Demo Threshold:</span> <span>${escapeHtml(f.threshold_reference)}</span>
                              </div>
                            </div>
                            <p class="text-xs text-slate-300"><strong class="text-slate-200">Reason:</strong> ${escapeHtml(f.explanation)}</p>
                          </div>
                        `;
                      })
                      .join('')}
                  </div>
                `
              }
            </div>

            <!-- General Next-Step Guidance -->
            <div class="mt-4">
              <h2 class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Recommended Next-Step Guidance</h2>
              <ul class="mt-2 space-y-1.5 text-xs text-slate-300 list-disc pl-5">
                ${(analysis?.nextSteps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
              </ul>
            </div>
          </div>

          <p class="text-xs text-amber-200/90 pt-3 border-t border-slate-800/80">
            Disclaimer: ${escapeHtml(analysis?.disclaimer || 'Demonstration thresholds only — not medically validated NASA flight standards. ASTROCARE AI is a monitoring prototype, not a clinically validated medical device, and does not diagnose diseases.')}
          </p>
        </div>

        <!-- Configurable Demonstration Thresholds & Limitations -->
        <div class="astro-panel lg:col-span-5 space-y-4">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h2 class="text-base font-semibold text-slate-100">Configurable Demo Thresholds</h2>
              <p class="text-xs text-amber-300/90 mt-0.5">Prototype settings only — not a clinically validated medical device.</p>
            </div>
            <button type="button" id="reset-thresholds-btn" class="astro-btn-secondary text-xs py-1.5 px-2.5">
              Reset Defaults
            </button>
          </div>

          ${
            activeThresholds
              ? `
            <form id="thresholds-form" class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="astro-label" for="th-hr-mod">HR Moderate High (bpm)</label>
                  <input id="th-hr-mod" name="heart_rate_high_mod" type="number" class="astro-input font-mono-tabular" value="${activeThresholds.heart_rate_high_mod}" />
                </div>
                <div>
                  <label class="astro-label" for="th-hr-crit">HR High Alert (bpm)</label>
                  <input id="th-hr-crit" name="heart_rate_high_crit" type="number" class="astro-input font-mono-tabular" value="${activeThresholds.heart_rate_high_crit}" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="astro-label" for="th-spo2-mod">SpO2 Moderate Floor (%)</label>
                  <input id="th-spo2-mod" name="spo2_mod_min" type="number" step="0.5" class="astro-input font-mono-tabular" value="${activeThresholds.spo2_mod_min}" />
                </div>
                <div>
                  <label class="astro-label" for="th-spo2-high">SpO2 High Alert Floor (%)</label>
                  <input id="th-spo2-high" name="spo2_high_min" type="number" step="0.5" class="astro-input font-mono-tabular" value="${activeThresholds.spo2_high_min}" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="astro-label" for="th-sys-mod">Systolic Mod High (mmHg)</label>
                  <input id="th-sys-mod" name="systolic_mod_high" type="number" class="astro-input font-mono-tabular" value="${activeThresholds.systolic_mod_high}" />
                </div>
                <div>
                  <label class="astro-label" for="th-sys-crit">Systolic High Alert (mmHg)</label>
                  <input id="th-sys-crit" name="systolic_crit_high" type="number" class="astro-input font-mono-tabular" value="${activeThresholds.systolic_crit_high}" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="astro-label" for="th-temp-mod">Temp Moderate High (°C)</label>
                  <input id="th-temp-mod" name="temp_mod_high" type="number" step="0.1" class="astro-input font-mono-tabular" value="${activeThresholds.temp_mod_high}" />
                </div>
                <div>
                  <label class="astro-label" for="th-temp-crit">Temp High Alert (°C)</label>
                  <input id="th-temp-crit" name="temp_crit_high" type="number" step="0.1" class="astro-input font-mono-tabular" value="${activeThresholds.temp_crit_high}" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="astro-label" for="th-sleep-mod">Sleep Watch Floor (hrs)</label>
                  <input id="th-sleep-mod" name="sleep_mod_min" type="number" step="0.5" class="astro-input font-mono-tabular" value="${activeThresholds.sleep_mod_min}" />
                </div>
                <div>
                  <label class="astro-label" for="th-sleep-drop">Sleep Drop Delta (hrs)</label>
                  <input id="th-sleep-drop" name="sleep_drop_mod" type="number" step="0.5" class="astro-input font-mono-tabular" value="${activeThresholds.sleep_drop_mod ?? 1.5}" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="astro-label" for="th-hr-delta">HR Shift Delta (bpm)</label>
                  <input id="th-hr-delta" name="hr_delta_mod" type="number" class="astro-input font-mono-tabular" value="${activeThresholds.hr_delta_mod}" />
                </div>
                <div>
                  <label class="astro-label" for="th-spo2-drop">SpO2 Drop Delta (%)</label>
                  <input id="th-spo2-drop" name="spo2_drop_mod" type="number" step="0.5" class="astro-input font-mono-tabular" value="${activeThresholds.spo2_drop_mod}" />
                </div>
              </div>

              <div id="thresholds-error" class="hidden p-2.5 rounded-lg status-box-high text-xs text-rose-200" role="alert"></div>

              <button type="submit" class="astro-btn-primary w-full">
                <i data-lucide="sliders" class="w-4 h-4"></i>
                <span>Save Demonstration Thresholds</span>
              </button>
              <p class="text-xs text-slate-400 leading-relaxed pt-1">
                Context rule: During <span class="text-slate-200">Exercise</span> or <span class="text-slate-200">EVA Prep</span>, upper HR watch limits automatically shift +25 bpm to avoid false exertion alerts.
              </p>
            </form>
          `
              : ''
          }

          <div class="p-3.5 astro-surface-muted space-y-1.5">
            <h3 class="text-xs font-semibold text-amber-200 uppercase tracking-wider">Demonstration Threshold Limitations</h3>
            <ul class="text-xs text-slate-300 space-y-1 list-disc pl-4 leading-relaxed">
              ${limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>

      <!-- Smart Alert Center -->
      <div class="astro-panel">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="text-base font-semibold text-slate-100">Smart Alert Center</h2>
            <p class="text-xs text-slate-400 mt-0.5">Categorized monitoring notifications generated from stored readings.</p>
          </div>
          <div class="astro-segmented" role="tablist" aria-label="Filter alerts">
            ${[
              { key: 'all', label: `All (${alerts.length})` },
              {
                key: 'unacknowledged',
                label: `Unacknowledged (${alerts.filter((a) => !a.acknowledged).length})`,
              },
              { key: 'HIGH', label: `HIGH (${alerts.filter((a) => a.severity === 'HIGH').length})` },
              {
                key: 'MODERATE',
                label: `MODERATE (${alerts.filter((a) => a.severity === 'MODERATE').length})`,
              },
            ]
              .map(
                (tab) => `
                <button
                  type="button"
                  role="tab"
                  aria-selected="${alertFilter === tab.key ? 'true' : 'false'}"
                  class="astro-segment-btn ${alertFilter === tab.key ? 'is-active' : ''}"
                  data-alert-filter="${tab.key}"
                >${tab.label}</button>
              `,
              )
              .join('')}
          </div>
        </div>

        ${
          filteredAlerts.length === 0
            ? `
            <div class="p-8 text-center astro-surface-muted">
              <p class="text-sm font-medium text-slate-200">No alerts match this filter</p>
              <p class="text-xs text-slate-400 mt-1">All monitoring warnings in this category are cleared or none have been triggered.</p>
            </div>
          `
            : `
            <div class="space-y-3">
              ${filteredAlerts
                .map((alert) => {
                  const st = getStatusMeta(alert.severity);
                  const factors = alert.triggered_metrics || [];
                  return `
                    <article class="p-4 rounded-lg ${st.boxClass} flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div class="space-y-2 flex-1">
                        <div class="flex flex-wrap items-center gap-2 text-xs">
                          <span class="font-bold font-mono-tabular ${st.textClass}">${st.glyph} ${escapeHtml(alert.severity)}</span>
                          <span aria-hidden="true" class="text-slate-500">·</span>
                          <span class="font-mono-tabular text-slate-300">${escapeHtml(formatDateTime(alert.created_at))}</span>
                          <span aria-hidden="true" class="text-slate-500">·</span>
                          <span class="text-slate-400">${alert.acknowledged ? `Acknowledged ${escapeHtml(formatDateTime(alert.acknowledged_at))}` : 'Requires Review'}</span>
                        </div>
                        <h3 class="text-sm font-semibold text-slate-50">${escapeHtml(alert.title)}</h3>
                        <p class="text-xs text-slate-300">${escapeHtml(alert.reason)}</p>
                        ${
                          factors.length > 0
                            ? `
                          <div class="space-y-1 pt-1">
                            ${factors
                              .map(
                                (f) => `
                              <div class="text-xs font-mono-tabular text-slate-300">
                                <span class="text-cyan-300">${escapeHtml(f.label)}</span>: ${escapeHtml(f.observed)} · Demo threshold: ${escapeHtml(f.threshold_reference)}
                              </div>
                            `,
                              )
                              .join('')}
                          </div>
                        `
                            : ''
                        }
                        <p class="text-xs text-slate-400 pt-1"><strong class="text-slate-300">Next Step:</strong> ${escapeHtml(alert.guidance)}</p>
                      </div>
                      <div class="shrink-0 flex items-center">
                        ${
                          alert.acknowledged
                            ? `<span class="text-xs font-mono-tabular text-emerald-300 flex items-center gap-1.5"><i data-lucide="check-circle-2" class="w-4 h-4"></i> Acknowledged</span>`
                            : `<button type="button" class="astro-btn-secondary text-xs" data-ack-id="${alert.id}">Acknowledge Alert #${alert.id}</button>`
                        }
                      </div>
                    </article>
                  `;
                })
                .join('')}
            </div>
          `
        }
      </div>
    </div>
  `;

  container.querySelectorAll('[data-risk-scenario]').forEach((btn) => {
    btn.addEventListener('click', () => handlers.onRunRiskScenario(btn.dataset.riskScenario));
  });

  container.querySelectorAll('[data-alert-filter]').forEach((btn) => {
    btn.addEventListener('click', () => handlers.onChangeAlertFilter(btn.dataset.alertFilter));
  });

  container.querySelectorAll('[data-ack-id]').forEach((btn) => {
    btn.addEventListener('click', () => handlers.onAcknowledgeAlert(Number(btn.dataset.ackId)));
  });

  container
    .querySelector('#reset-thresholds-btn')
    ?.addEventListener('click', handlers.onResetThresholds);

  const thForm = container.querySelector('#thresholds-form');
  thForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = container.querySelector('#thresholds-error');
    errBox.classList.add('hidden');
    const fd = new FormData(thForm);
    const updates = {};
    for (const [k, v] of fd.entries()) {
      updates[k] = Number(v);
    }
    try {
      await handlers.onSaveThresholds(updates);
    } catch (err) {
      errBox.textContent = err.message || 'Unable to save thresholds.';
      errBox.classList.remove('hidden');
    }
  });
}
