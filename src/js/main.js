import { api } from './api.js';
import { renderAnalytics } from './modules/analytics.js';
import { renderAssistant } from './modules/assistant.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderMonitoring } from './modules/monitoring.js';
import { renderResearch } from './modules/research.js';
import { renderRiskAlerts } from './modules/riskAlerts.js';
import { refreshIcons, showToast } from './utils.js';

const VALID_VIEWS = [
  'dashboard',
  'monitoring',
  'risk-alerts',
  'assistant',
  'analytics',
  'research',
];

const state = {
  activeView: 'dashboard',
  currentState: null,
  history: [],
  alerts: [],
  thresholds: null,
  analytics: null,
  assistantMessages: [],
  monitoringMetric: 'heart_rate',
  alertFilter: 'all',
  isSimulating: false,
  isAssistantBusy: false,
  assistantError: null,
  simTimer: null,
};

function updateAlertBadges() {
  const count = state.currentState?.unacknowledgedCount ?? 0;
  ['nav-alert-count', 'mobile-alert-count'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = String(count);
    el.classList.toggle('hidden', count <= 0);
  });
}

function setActiveNav(view) {
  state.activeView = VALID_VIEWS.includes(view) ? view : 'dashboard';
  window.location.hash = state.activeView;

  document.querySelectorAll('.astro-nav-link, .astro-mobile-link').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === state.activeView);
  });

  VALID_VIEWS.forEach((v) => {
    const sec = document.getElementById(`view-${v}`);
    if (sec) sec.classList.toggle('hidden', v !== state.activeView);
  });

  // Close mobile drawer on navigate
  const drawer = document.getElementById('mobile-nav-drawer');
  const toggle = document.getElementById('mobile-menu-toggle');
  if (drawer && !drawer.classList.contains('hidden')) {
    drawer.classList.add('hidden');
    toggle?.setAttribute('aria-expanded', 'false');
  }

  renderCurrentView();
}

const handlers = {
  onNavigate(view) {
    setActiveNav(view);
  },
  onToggleSimulation() {
    if (state.isSimulating) {
      clearInterval(state.simTimer);
      state.simTimer = null;
      state.isSimulating = false;
      showToast('Live simulated telemetry paused.');
    } else {
      state.isSimulating = true;
      state.simTimer = setInterval(() => {
        handlers.onSimulateNow(true);
      }, 6000);
      showToast('Live simulated telemetry running (every 6s).');
    }
    renderCurrentView();
  },
  async onSimulateNow(silent = false) {
    try {
      const res = await api.simulateReading();
      await refreshAllData();
      if (!silent) {
        showToast(
          `Simulated reading saved: ${res.reading.heart_rate} bpm · ${res.reading.spo2.toFixed(1)}% SpO2 (${res.analysis.level})`,
        );
      }
    } catch (err) {
      showToast(err.message || 'Failed to simulate reading.', true);
    }
  },
  async onSubmitReading(payload) {
    const res = await api.submitReading(payload);
    await refreshAllData();
    showToast(
      `Reading saved (${res.analysis.level} status).${res.alert ? ' Smart alert generated.' : ''}`,
    );
  },
  async onRunRiskScenario(scenarioKey) {
    const scenarios = {
      normal: {
        heart_rate: 70,
        spo2: 98.3,
        systolic_bp: 116,
        diastolic_bp: 74,
        body_temp_c: 36.7,
        sleep_hours: 7.4,
        activity_level: 'Light',
        source: 'simulated_live',
      },
      moderate: {
        heart_rate: 105,
        spo2: 93.6,
        systolic_bp: 138,
        diastolic_bp: 85,
        body_temp_c: 37.6,
        sleep_hours: 5.2,
        activity_level: 'Rest',
        source: 'simulated_live',
      },
      high: {
        heart_rate: 122,
        spo2: 90.2,
        systolic_bp: 152,
        diastolic_bp: 96,
        body_temp_c: 38.3,
        sleep_hours: 4.2,
        activity_level: 'Rest',
        source: 'simulated_live',
      },
    };
    const payload = scenarios[scenarioKey];
    if (!payload) return;
    try {
      const res = await api.submitReading(payload);
      await refreshAllData();
      showToast(
        `Scenario "${scenarioKey.toUpperCase()}" evaluated: ${res.analysis.level} (${res.analysis.triggeredFactors.length} rules triggered).`,
      );
    } catch (err) {
      showToast(err.message || 'Failed to run test scenario.', true);
    }
  },
  onChangeMonitoringMetric(metric) {
    state.monitoringMetric = metric;
    renderCurrentView();
  },
  onChangeAlertFilter(filter) {
    state.alertFilter = filter;
    renderCurrentView();
  },
  async onAcknowledgeAlert(id) {
    try {
      await api.acknowledgeAlert(id);
      await refreshAllData();
      showToast(`Alert #${id} acknowledged and saved.`);
    } catch (err) {
      showToast(err.message || 'Failed to acknowledge alert.', true);
    }
  },
  async onSaveThresholds(updates) {
    const res = await api.updateThresholds(updates);
    state.thresholds = res.thresholds;
    await refreshAllData();
    showToast('Demonstration thresholds updated.');
  },
  async onResetThresholds() {
    try {
      const res = await api.resetThresholds();
      state.thresholds = res.thresholds;
      await refreshAllData();
      showToast('Demonstration thresholds reset to defaults.');
    } catch (err) {
      showToast(err.message || 'Failed to reset thresholds.', true);
    }
  },
  onAssistantValidationError(message) {
    state.assistantError = { message, failedQuestion: null };
    renderCurrentView();
  },
  onDismissAssistantError() {
    state.assistantError = null;
    renderCurrentView();
  },
  async onSendAssistantMessage(text) {
    if (state.isAssistantBusy) return;
    const prevMessages = [...state.assistantMessages];
    state.assistantError = null;
    state.isAssistantBusy = true;
    state.assistantMessages = [
      ...prevMessages,
      {
        id: Date.now(),
        created_at: new Date().toISOString(),
        role: 'user',
        content: text,
      },
    ];
    renderCurrentView();

    try {
      const res = await api.sendAssistantMessage(text);
      const hist = await api.getAssistantHistory();
      state.assistantMessages = hist.messages;
      if (res.mode === 'gemini') {
        showToast('Assistant replied using Gemini grounded telemetry.');
      }
    } catch (err) {
      state.assistantMessages = prevMessages;
      const raw = err?.message || '';
      const friendly = /failed to fetch|networkerror|load failed/i.test(raw)
        ? 'Could not reach the ASTROCARE backend right now. Please check your connection and try again.'
        : raw || 'Something went wrong while analyzing your stored telemetry. Please try again.';
      state.assistantError = {
        message: friendly,
        failedQuestion: text,
      };
      showToast(friendly, true);
    } finally {
      state.isAssistantBusy = false;
      renderCurrentView();
    }
  },
};

function renderCurrentView() {
  const container = document.getElementById(`view-${state.activeView}`);
  if (!container) return;

  switch (state.activeView) {
    case 'dashboard':
      renderDashboard(container, state, handlers);
      break;
    case 'monitoring':
      renderMonitoring(container, state, handlers);
      break;
    case 'risk-alerts':
      renderRiskAlerts(container, state, handlers);
      break;
    case 'assistant':
      renderAssistant(container, state, handlers);
      break;
    case 'analytics':
      renderAnalytics(container, state);
      break;
    case 'research':
      renderResearch(container);
      break;
    default:
      renderDashboard(container, state, handlers);
  }

  refreshIcons();
}

async function refreshAllData(shouldRender = true) {
  const [currentRes, historyRes, alertsRes, analyticsRes, thresholdsRes, chatRes] =
    await Promise.all([
      api.getCurrentHealth(),
      api.getHealthHistory(50),
      api.getAlerts(),
      api.getAnalytics(),
      api.getThresholds(),
      api.getAssistantHistory(),
    ]);

  state.currentState = currentRes;
  state.history = historyRes.readings || [];
  state.alerts = alertsRes.alerts || [];
  state.analytics = analyticsRes;
  state.thresholds = thresholdsRes.thresholds;
  state.assistantMessages = chatRes.messages || [];

  updateAlertBadges();
  if (shouldRender) renderCurrentView();
}

async function bootstrap() {
  const loadingEl = document.getElementById('app-loading');
  const errorEl = document.getElementById('app-error');
  const errorMsgEl = document.getElementById('app-error-message');

  loadingEl?.classList.remove('hidden');
  errorEl?.classList.add('hidden');

  try {
    await refreshAllData(false);
    loadingEl?.classList.add('hidden');

    const initialHash = window.location.hash.replace('#', '');
    setActiveNav(VALID_VIEWS.includes(initialHash) ? initialHash : 'dashboard');
  } catch (err) {
    loadingEl?.classList.add('hidden');
    if (errorMsgEl) errorMsgEl.textContent = err.message || 'Server error';
    errorEl?.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  refreshIcons();

  // Bind navigation buttons
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => setActiveNav(btn.dataset.view));
  });

  document.querySelector('[data-nav-link="dashboard"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    setActiveNav('dashboard');
  });

  document.getElementById('header-log-reading-btn')?.addEventListener('click', () => {
    setActiveNav('monitoring');
    setTimeout(() => {
      document.getElementById('input-hr')?.focus();
    }, 60);
  });

  document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
    const drawer = document.getElementById('mobile-nav-drawer');
    const toggle = document.getElementById('mobile-menu-toggle');
    if (!drawer || !toggle) return;
    const isHidden = drawer.classList.toggle('hidden');
    toggle.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
  });

  document.getElementById('retry-bootstrap-btn')?.addEventListener('click', bootstrap);

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (VALID_VIEWS.includes(hash) && hash !== state.activeView) {
      setActiveNav(hash);
    }
  });

  bootstrap();
});
