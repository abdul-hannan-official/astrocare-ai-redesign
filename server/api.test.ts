import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

// Point SQLite to an isolated temp database before importing server/app.ts
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astrocare-api-test-'));
const tempDbPath = path.join(tempDir, 'test.db');
process.env.DATABASE_PATH = tempDbPath;
// Force deterministic assistant path during fast unit/API tests
process.env.GEMINI_API_KEY = '';

const { createApiApp } = await import('./app.ts');

const app = createApiApp();
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = (server.address() as AddressInfo).port;
const baseUrl = `http://127.0.0.1:${port}`;

test.after(() => {
  server.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('GET /api/health/current returns Alex Morgan profile, seeded reading, and risk analysis', async () => {
  const res = await fetch(`${baseUrl}/api/health/current`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.profile.name, 'Alex Morgan');
  assert.ok(body.current);
  assert.ok(body.analysis);
  assert.ok(body.thresholds);
  assert.match(body.disclaimer, /Demonstration thresholds only/i);
});

test('GET /api/health/history returns seeded readings and rejects invalid query params', async () => {
  const res = await fetch(`${baseUrl}/api/health/history?limit=10&hours=48`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.readings));
  assert.ok(body.readings.length > 0 && body.readings.length <= 10);

  const badLimit = await fetch(`${baseUrl}/api/health/history?limit=999`);
  assert.equal(badLimit.status, 400);

  const badHours = await fetch(`${baseUrl}/api/health/history?hours=-5`);
  assert.equal(badHours.status, 400);
});

test('POST /api/health/readings validates inputs, rejects malformed JSON, and persists new HIGH alert reading', async () => {
  const malformed = await fetch(`${baseUrl}/api/health/readings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  assert.equal(malformed.status, 400);
  const malformedBody = await malformed.json();
  assert.equal(malformedBody.error, 'Invalid JSON payload.');

  const blankSleep = await fetch(`${baseUrl}/api/health/readings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      heart_rate: 72,
      spo2: 98,
      systolic_bp: 118,
      diastolic_bp: 76,
      body_temp_c: 36.7,
      sleep_hours: '',
      activity_level: 'Rest',
    }),
  });
  assert.equal(blankSleep.status, 400);

  const invalidBp = await fetch(`${baseUrl}/api/health/readings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      heart_rate: 72,
      spo2: 98,
      systolic_bp: 100,
      diastolic_bp: 110,
      body_temp_c: 36.7,
      sleep_hours: 7,
      activity_level: 'Rest',
    }),
  });
  assert.equal(invalidBp.status, 400);

  const created = await fetch(`${baseUrl}/api/health/readings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      heart_rate: 124,
      spo2: 90.1,
      systolic_bp: 152,
      diastolic_bp: 94,
      body_temp_c: 38.3,
      sleep_hours: 4.3,
      activity_level: 'Rest',
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.reading.heart_rate, 124);
  assert.equal(createdBody.analysis.level, 'HIGH');
  assert.ok(createdBody.alert);
  assert.equal(createdBody.alert.severity, 'HIGH');

  // Verify persistence in GET /api/health/history
  const histRes = await fetch(`${baseUrl}/api/health/history?limit=1`);
  const histBody = await histRes.json();
  assert.equal(histBody.readings[0].id, createdBody.reading.id);
});

test('POST /api/health/simulate creates and persists a simulated reading', async () => {
  const res = await fetch(`${baseUrl}/api/health/simulate`, { method: 'POST' });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.reading.source, 'simulated_live');
});

test('GET /api/alerts and POST /api/alerts/:id/acknowledge filter and persist acknowledgement', async () => {
  const badFilter = await fetch(`${baseUrl}/api/alerts?severity=CRITICAL`);
  assert.equal(badFilter.status, 400);

  const unackRes = await fetch(`${baseUrl}/api/alerts?status=unacknowledged`);
  assert.equal(unackRes.status, 200);
  const unackBody = await unackRes.json();
  assert.ok(unackBody.alerts.length >= 1);

  const targetId = unackBody.alerts[0].id;
  const ackRes = await fetch(`${baseUrl}/api/alerts/${targetId}/acknowledge`, {
    method: 'POST',
  });
  assert.equal(ackRes.status, 200);
  const ackBody = await ackRes.json();
  assert.equal(ackBody.alert.acknowledged, true);
  assert.ok(ackBody.alert.acknowledged_at);

  const missingRes = await fetch(`${baseUrl}/api/alerts/999999/acknowledge`, {
    method: 'POST',
  });
  assert.equal(missingRes.status, 404);

  const invalidIdRes = await fetch(`${baseUrl}/api/alerts/abc/acknowledge`, {
    method: 'POST',
  });
  assert.equal(invalidIdRes.status, 400);
});

test('GET/PUT/POST /api/thresholds validate and persist threshold changes', async () => {
  const badRes = await fetch(`${baseUrl}/api/thresholds`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spo2_high_min: 97, spo2_mod_min: 94 }),
  });
  assert.equal(badRes.status, 400);

  const okRes = await fetch(`${baseUrl}/api/thresholds`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spo2_mod_min: 95 }),
  });
  assert.equal(okRes.status, 200);
  const okBody = await okRes.json();
  assert.equal(okBody.thresholds.spo2_mod_min, 95);

  const resetRes = await fetch(`${baseUrl}/api/thresholds/reset`, { method: 'POST' });
  assert.equal(resetRes.status, 200);
  const resetBody = await resetRes.json();
  assert.equal(resetBody.thresholds.spo2_mod_min, 94);
});

test('GET /api/analytics and GET /api/analytics/export.csv return valid analytics and CSV', async () => {
  const res = await fetch(`${baseUrl}/api/analytics`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.readings24h));
  assert.ok(Array.isArray(body.daily7d));
  assert.ok(body.summary.totalReadings >= 20);

  const csvRes = await fetch(`${baseUrl}/api/analytics/export.csv`);
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.headers.get('content-type') || '', /text\/csv/);
  const csvText = await csvRes.text();
  assert.ok(csvText.startsWith('id,recorded_at,heart_rate_bpm,spo2_pct'));
});

test('POST /api/assistant/chat validates message, uses stored history/alerts, and explains in simple English', async () => {
  const emptyRes = await fetch(`${baseUrl}/api/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '   ' }),
  });
  assert.equal(emptyRes.status, 400);
  const emptyBody = await emptyRes.json();
  assert.match(emptyBody.error, /1 and 600 characters/i);

  const questions = [
    {
      q: 'What does my current SpO2 reading mean?',
      expectMatch: /SpO2|oxygen/i,
    },
    {
      q: 'Why is my heart rate different from yesterday?',
      expectMatch: /heart rate|bpm/i,
    },
    {
      q: 'How has my sleep changed?',
      expectMatch: /sleep|7-day/i,
    },
    {
      q: 'Explain my recent alerts and 7-day trends in simple English.',
      expectMatch: /7-Day|Alert/i,
    },
    {
      q: 'How do my blood pressure and body temperature look?',
      expectMatch: /Blood Pressure|Temperature/i,
    },
  ];

  for (const item of questions) {
    const chatRes = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: item.q }),
    });
    assert.equal(chatRes.status, 200);
    const chatBody = await chatRes.json();
    assert.ok(chatBody.reply.length > 40);
    assert.match(chatBody.reply, item.expectMatch);
    assert.match(chatBody.contextSummary, /7d Avg Sleep:/i);
    assert.doesNotMatch(chatBody.reply, /you have (hypertension|hypoxia|pneumonia|sepsis)/i);
  }

  const histRes = await fetch(`${baseUrl}/api/assistant/history`);
  assert.equal(histRes.status, 200);
  const histBody = await histRes.json();
  assert.ok(histBody.messages.some((m: { content: string }) => m.content.includes('SpO2')));
  assert.ok(histBody.messages.some((m: { content: string }) => m.content.includes('7-Day')));
});

test('Unknown /api/* endpoint returns 404 JSON', async () => {
  const res = await fetch(`${baseUrl}/api/nonexistent`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error, 'API endpoint not found.');
});
