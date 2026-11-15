/**
 * API client module for ASTROCARE AI Express backend.
 */

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const details = Array.isArray(payload?.details) ? ` ${payload.details.join(' ')}` : '';
    const message = (payload?.error || `Request failed (${response.status})`) + details;
    throw new Error(message);
  }

  return payload;
}

export const api = {
  getCurrentHealth() {
    return request('/api/health/current');
  },
  getHealthHistory(limit = 40, hours = null) {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (hours) qs.set('hours', String(hours));
    return request(`/api/health/history?${qs.toString()}`);
  },
  submitReading(data) {
    return request('/api/health/readings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  simulateReading() {
    return request('/api/health/simulate', {
      method: 'POST',
    });
  },
  getAlerts(severity = '', status = '') {
    const qs = new URLSearchParams();
    if (severity) qs.set('severity', severity);
    if (status) qs.set('status', status);
    const query = qs.toString();
    return request(`/api/alerts${query ? `?${query}` : ''}`);
  },
  acknowledgeAlert(id) {
    return request(`/api/alerts/${id}/acknowledge`, {
      method: 'POST',
    });
  },
  getThresholds() {
    return request('/api/thresholds');
  },
  updateThresholds(thresholds) {
    return request('/api/thresholds', {
      method: 'PUT',
      body: JSON.stringify(thresholds),
    });
  },
  resetThresholds() {
    return request('/api/thresholds/reset', {
      method: 'POST',
    });
  },
  getAnalytics() {
    return request('/api/analytics');
  },
  getAssistantHistory() {
    return request('/api/assistant/history');
  },
  sendAssistantMessage(message) {
    return request('/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },
};
