import { escapeHtml, formatDateTime } from '../utils.js';

const SUGGESTED_QUESTIONS = [
  'What does my current SpO2 reading mean?',
  'Why is my heart rate different from yesterday?',
  'How has my sleep changed?',
  'Which readings should I monitor?',
  'Explain my recent alerts and 7-day trends in simple English.',
  'How do my blood pressure and body temperature look?',
];

export function renderAssistant(container, state, handlers) {
  const { currentState, analytics, assistantMessages, isAssistantBusy, assistantError } = state;
  const cur = currentState?.current;
  const unack = currentState?.unacknowledgedCount ?? 0;
  const summary = analytics?.summary;

  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      <!-- Left: Grounded Telemetry Context & Quick Prompts -->
      <div class="astro-panel lg:col-span-4 flex flex-col justify-between gap-4">
        <div>
          <p class="text-xs text-cyan-300 font-medium">GROUNDED TELEMETRY INTELLIGENCE</p>
          <h1 class="text-xl font-bold text-slate-50 mt-0.5">AI Health Assistant</h1>
          <p class="text-xs text-slate-400 mt-1 leading-relaxed">
            Explains Alex Morgan's stored readings, 7-day trends, and alerts in simple English. Never invents data, diagnoses diseases, or accesses live NASA medical systems.
          </p>

          <div class="mt-4 p-3.5 astro-surface-muted space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-semibold text-slate-200">Stored Readings &amp; History Context</span>
              ${
                summary
                  ? `<span class="text-[11px] font-mono-tabular text-cyan-300">${summary.totalReadings} logs</span>`
                  : ''
              }
            </div>
            ${
              cur
                ? `
              <div class="grid grid-cols-2 gap-2 text-xs font-mono-tabular">
                <div><span class="text-slate-400">HR:</span> <span class="text-slate-100">${cur.heart_rate} bpm</span></div>
                <div><span class="text-slate-400">SpO2:</span> <span class="text-slate-100">${cur.spo2.toFixed(1)}%</span></div>
                <div><span class="text-slate-400">BP:</span> <span class="text-slate-100">${cur.systolic_bp}/${cur.diastolic_bp}</span></div>
                <div><span class="text-slate-400">Sleep:</span> <span class="text-slate-100">${cur.sleep_hours.toFixed(1)} hrs</span></div>
                <div><span class="text-slate-400">Temp:</span> <span class="text-slate-100">${cur.body_temp_c.toFixed(1)} °C</span></div>
                <div><span class="text-slate-400">Alerts:</span> <span class="text-slate-100">${unack} open</span></div>
              </div>
              ${
                summary
                  ? `
                <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono-tabular text-slate-300">
                  <div><span class="text-slate-400">24h Avg HR:</span> ${summary.avg24hHr} bpm</div>
                  <div><span class="text-slate-400">7d Avg Sleep:</span> ${summary.avg7dSleep.toFixed(1)} hrs</div>
                </div>
              `
                  : ''
              }
              <div class="text-xs text-slate-400 pt-1">Updated ${escapeHtml(formatDateTime(cur.recorded_at))}</div>
            `
                : `
              <div class="flex items-center gap-2 text-xs text-slate-400 py-1">
                <div class="astro-spinner" style="width:14px;height:14px;"></div>
                <span>Loading stored telemetry context...</span>
              </div>
            `
            }
          </div>

          <div class="mt-4">
            <h2 class="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Suggested Questions</h2>
            <div class="space-y-2">
              ${SUGGESTED_QUESTIONS.map(
                (q) => `
                  <button
                    type="button"
                    class="w-full text-left p-2.5 rounded-lg astro-surface-muted hover:border-cyan-400/40 text-xs text-slate-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    data-quick-question="${escapeHtml(q)}"
                    ${isAssistantBusy ? 'disabled' : ''}
                  >${escapeHtml(q)}</button>
                `,
              ).join('')}
            </div>
          </div>
        </div>

        <p class="text-xs text-slate-500 pt-2 border-t border-slate-800/80">
          AI calls run server-side only (no browser API keys). Uses locally stored simulated data with grounded deterministic fallback.
        </p>
      </div>

      <!-- Right: Chat Thread, Loading State, Friendly Error Banner & Input -->
      <div class="astro-panel lg:col-span-8 flex flex-col justify-between min-h-[540px]">
        <div class="flex-1 flex flex-col min-h-0">
          <div class="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80 shrink-0">
            <div class="flex items-center gap-2.5">
              <h2 class="text-base font-semibold text-slate-100">Crew Health Dialogue</h2>
              ${
                isAssistantBusy
                  ? `<span class="text-xs font-mono-tabular text-cyan-300 animate-pulse">Analyzing telemetry...</span>`
                  : ''
              }
            </div>
            <span class="text-xs text-slate-400 font-mono-tabular">${assistantMessages.length} messages</span>
          </div>

          <div id="assistant-chat-log" class="mt-4 flex-1 space-y-3 min-h-[360px] max-h-[580px] overflow-y-auto pr-1">
            ${
              assistantMessages.length === 0 && !isAssistantBusy
                ? `
              <div class="p-6 text-center astro-surface-muted">
                <p class="text-sm font-medium text-slate-200">Ask a question about Alex Morgan's telemetry</p>
                <p class="text-xs text-slate-400 mt-1">Select a suggested prompt or ask about SpO2, heart rate shifts, sleep history, or open alerts.</p>
              </div>
            `
                : assistantMessages
                    .map((m) => {
                      const isUser = m.role === 'user';
                      return `
                        <div class="flex ${isUser ? 'justify-end' : 'justify-start'}">
                          <div class="max-w-[88%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                            isUser
                              ? 'bg-cyan-500/15 border border-cyan-400/35 text-slate-100'
                              : 'astro-surface-muted text-slate-200'
                          }">
                            <div class="flex items-center justify-between gap-4 text-xs mb-1 ${isUser ? 'text-cyan-300' : 'text-slate-400'}">
                              <span class="font-semibold">${isUser ? 'Alex Morgan (Crew)' : 'ASTROCARE AI Assistant'}</span>
                              <span class="font-mono-tabular">${escapeHtml(formatDateTime(m.created_at))}</span>
                            </div>
                            <div class="whitespace-pre-line text-xs sm:text-sm">${escapeHtml(m.content)}</div>
                          </div>
                        </div>
                      `;
                    })
                    .join('')
            }
            ${
              isAssistantBusy
                ? `
              <div class="flex justify-start" role="status" aria-live="polite">
                <div class="astro-surface-muted px-4 py-3 rounded-xl text-xs text-cyan-300 flex items-center gap-2.5">
                  <div class="astro-spinner" style="width:16px;height:16px;"></div>
                  <span>Reviewing Alex Morgan's stored readings, 7-day history, and alert log...</span>
                </div>
              </div>
            `
                : ''
            }
          </div>
        </div>

        <div class="mt-4 space-y-3">
          ${
            assistantError
              ? `
            <div id="assistant-error-banner" class="p-3 rounded-lg status-box-high flex flex-col sm:flex-row sm:items-center justify-between gap-3" role="alert">
              <div class="space-y-0.5">
                <p class="text-xs font-semibold text-rose-200">Assistant could not complete your request</p>
                <p class="text-xs text-rose-100/90">${escapeHtml(assistantError.message)}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                ${
                  assistantError.failedQuestion
                    ? `<button type="button" class="astro-btn-secondary text-xs py-1 px-2.5" data-retry-assistant>Try Again</button>`
                    : ''
                }
                <button type="button" class="astro-btn-secondary text-xs py-1 px-2.5" data-dismiss-assistant-error>Dismiss</button>
              </div>
            </div>
          `
              : ''
          }

          <form id="assistant-chat-form" novalidate class="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row gap-2.5">
            <label class="sr-only" for="assistant-input">Ask ASTROCARE AI Assistant</label>
            <input
              id="assistant-input"
              name="message"
              type="text"
              maxlength="600"
              placeholder="Ask about SpO2, heart rate changes, sleep history, alerts, or trends..."
              class="astro-input flex-1"
              ${isAssistantBusy ? 'disabled' : ''}
            />
            <button type="submit" class="astro-btn-primary" ${isAssistantBusy ? 'disabled' : ''}>
              ${
                isAssistantBusy
                  ? `<div class="astro-spinner" style="width:15px;height:15px;border-top-color:#fff;"></div><span>Thinking...</span>`
                  : `<i data-lucide="send" class="w-4 h-4"></i><span>Ask Assistant</span>`
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  const logEl = container.querySelector('#assistant-chat-log');
  if (logEl) {
    logEl.scrollTop = logEl.scrollHeight;
  }

  container.querySelectorAll('[data-quick-question]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.isAssistantBusy) return;
      handlers.onSendAssistantMessage(btn.dataset.quickQuestion);
    });
  });

  container.querySelector('[data-retry-assistant]')?.addEventListener('click', () => {
    if (state.assistantError?.failedQuestion && !state.isAssistantBusy) {
      handlers.onSendAssistantMessage(state.assistantError.failedQuestion);
    }
  });

  container.querySelector('[data-dismiss-assistant-error]')?.addEventListener('click', () => {
    handlers.onDismissAssistantError();
  });

  const form = container.querySelector('#assistant-chat-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.isAssistantBusy) return;
    const input = container.querySelector('#assistant-input');
    const text = input.value.trim();
    if (!text) {
      handlers.onAssistantValidationError('Please enter a question about your readings, trends, or alerts before sending.');
      input.focus();
      return;
    }
    if (text.length > 600) {
      handlers.onAssistantValidationError('Your question is a bit long—please keep it under 600 characters.');
      input.focus();
      return;
    }
    input.value = '';
    handlers.onSendAssistantMessage(text);
  });
}

