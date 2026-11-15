import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {
  analyzeReading,
  DEFAULT_THRESHOLDS,
} from './riskEngine.ts';
import type {
  ActivityLevel,
  AlertRecord,
  AstronautProfile,
  HealthReading,
  HealthReadingInput,
  RiskAnalysisResult,
  RiskLevel,
  RiskThresholds,
} from './types.ts';

const DB_PATH = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/astrocare.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Initialize SQLite schema and seed deterministic demo data if empty.
 */
export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS astronaut_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      callsign TEXT NOT NULL,
      role TEXT NOT NULL,
      mission_name TEXT NOT NULL,
      habitat_module TEXT NOT NULL,
      mission_day INTEGER NOT NULL,
      mission_duration_days INTEGER NOT NULL,
      baseline_notes TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS health_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      heart_rate INTEGER NOT NULL,
      spo2 REAL NOT NULL,
      systolic_bp INTEGER NOT NULL,
      diastolic_bp INTEGER NOT NULL,
      body_temp_c REAL NOT NULL,
      sleep_hours REAL NOT NULL,
      activity_level TEXT NOT NULL,
      source TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      risk_summary TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reading_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      triggered_metrics TEXT NOT NULL,
      reason TEXT NOT NULL,
      guidance TEXT NOT NULL,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      acknowledged_at TEXT,
      FOREIGN KEY (reading_id) REFERENCES health_readings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS risk_thresholds (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      config_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assistant_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      context_summary TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_health_readings_recorded_at ON health_readings(recorded_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC, acknowledged);
  `);

  seedInitialData();
}

function seedInitialData(): void {
  const profileCount = db
    .prepare('SELECT COUNT(*) as count FROM astronaut_profile')
    .get() as { count: number };

  if (profileCount.count === 0) {
    db.prepare(
      `INSERT INTO astronaut_profile (
        id, name, callsign, role, mission_name, habitat_module,
        mission_day, mission_duration_days, baseline_notes
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'Alex Morgan',
      'ORBIT-04',
      'Mission Specialist · Biomedical Payload Lead',
      'Simulated LEO Endurance Mission',
      'Node 3 Habitation Module (Simulated)',
      47,
      180,
      'Fictional crew profile for demonstration. Resting baseline ~68 bpm HR, 98% SpO2, 118/76 mmHg, 7.3 hrs sleep.',
    );
  }

  const thresholdCount = db
    .prepare('SELECT COUNT(*) as count FROM risk_thresholds')
    .get() as { count: number };

  if (thresholdCount.count === 0) {
    db.prepare(
      'INSERT INTO risk_thresholds (id, config_json, updated_at) VALUES (1, ?, ?)',
    ).run(JSON.stringify(DEFAULT_THRESHOLDS), new Date().toISOString());
  }

  const readingCount = db
    .prepare('SELECT COUNT(*) as count FROM health_readings')
    .get() as { count: number };

  if (readingCount.count === 0) {
    const now = Date.now();
    const hourMs = 3600 * 1000;

    // 7 days of realistic simulated readings including normal, unusual, and warning states
    const seedPoints: Array<{
      hoursAgo: number;
      hr: number;
      spo2: number;
      sys: number;
      dia: number;
      temp: number;
      sleep: number;
      activity: ActivityLevel;
    }> = [
      // Days 6 to 2 ago (routine circadian and exercise patterns)
      { hoursAgo: 162, hr: 67, spo2: 98.4, sys: 116, dia: 74, temp: 36.7, sleep: 7.6, activity: 'Rest' },
      { hoursAgo: 150, hr: 76, spo2: 98.1, sys: 120, dia: 77, temp: 36.8, sleep: 7.6, activity: 'Moderate' },
      { hoursAgo: 138, hr: 69, spo2: 98.3, sys: 117, dia: 75, temp: 36.7, sleep: 7.4, activity: 'Light' },
      { hoursAgo: 126, hr: 114, spo2: 97.6, sys: 128, dia: 80, temp: 37.1, sleep: 7.4, activity: 'Exercise' },
      { hoursAgo: 114, hr: 66, spo2: 98.5, sys: 115, dia: 73, temp: 36.6, sleep: 7.2, activity: 'Rest' },
      { hoursAgo: 102, hr: 74, spo2: 98.0, sys: 119, dia: 76, temp: 36.8, sleep: 7.2, activity: 'Light' },
      { hoursAgo: 90, hr: 84, spo2: 97.4, sys: 124, dia: 79, temp: 36.9, sleep: 6.8, activity: 'Moderate' },
      { hoursAgo: 78, hr: 68, spo2: 98.2, sys: 116, dia: 74, temp: 36.7, sleep: 6.8, activity: 'Rest' },
      // 48h - 28h ago: Unusual moderate sleep deficit & mild tachycardia at rest
      { hoursAgo: 62, hr: 73, spo2: 97.9, sys: 118, dia: 75, temp: 36.8, sleep: 6.5, activity: 'Light' },
      { hoursAgo: 46, hr: 103, spo2: 96.4, sys: 131, dia: 84, temp: 37.2, sleep: 5.4, activity: 'Rest' },
      { hoursAgo: 34, hr: 82, spo2: 97.2, sys: 122, dia: 78, temp: 36.9, sleep: 5.4, activity: 'Light' },
      // Last 24h dense telemetry series
      { hoursAgo: 23, hr: 70, spo2: 98.1, sys: 118, dia: 75, temp: 36.7, sleep: 6.3, activity: 'Rest' },
      { hoursAgo: 20, hr: 74, spo2: 97.9, sys: 119, dia: 76, temp: 36.8, sleep: 6.3, activity: 'Light' },
      { hoursAgo: 17, hr: 88, spo2: 97.2, sys: 125, dia: 80, temp: 36.9, sleep: 6.3, activity: 'EVA Prep' },
      { hoursAgo: 14, hr: 118, spo2: 97.0, sys: 132, dia: 82, temp: 37.2, sleep: 6.3, activity: 'Exercise' },
      // Warning / HIGH scenario (~10h ago): transient SpO2 dip + elevated HR/BP at rest
      { hoursAgo: 10, hr: 119, spo2: 90.6, sys: 148, dia: 92, temp: 37.6, sleep: 5.6, activity: 'Rest' },
      // Recovery trajectory to current
      { hoursAgo: 7, hr: 91, spo2: 94.8, sys: 130, dia: 83, temp: 37.1, sleep: 5.6, activity: 'Rest' },
      { hoursAgo: 5, hr: 79, spo2: 96.8, sys: 122, dia: 78, temp: 36.9, sleep: 6.1, activity: 'Rest' },
      { hoursAgo: 3, hr: 75, spo2: 97.6, sys: 119, dia: 76, temp: 36.8, sleep: 6.1, activity: 'Light' },
      { hoursAgo: 1, hr: 72, spo2: 98.0, sys: 118, dia: 75, temp: 36.7, sleep: 6.1, activity: 'Light' },
    ];

    const thresholds = getThresholds();
    for (let i = 0; i < seedPoints.length; i++) {
      const pt = seedPoints[i];
      const recordedAt = new Date(now - pt.hoursAgo * hourMs).toISOString();
      const recent = getHistory(6);
      const input: HealthReadingInput = {
        heart_rate: pt.hr,
        spo2: pt.spo2,
        systolic_bp: pt.sys,
        diastolic_bp: pt.dia,
        body_temp_c: pt.temp,
        sleep_hours: pt.sleep,
        activity_level: pt.activity,
        source: 'simulated_seed',
        recorded_at: recordedAt,
      };
      const analysis = analyzeReading(input, recent, thresholds);

      const info = db
        .prepare(
          `INSERT INTO health_readings (
            recorded_at, heart_rate, spo2, systolic_bp, diastolic_bp,
            body_temp_c, sleep_hours, activity_level, source, risk_level, risk_summary
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          recordedAt,
          input.heart_rate,
          input.spo2,
          input.systolic_bp,
          input.diastolic_bp,
          input.body_temp_c,
          input.sleep_hours,
          input.activity_level,
          'simulated_seed',
          analysis.level,
          analysis.summary,
        );

      const readingId = Number(info.lastInsertRowid);
      if (analysis.level === 'MODERATE' || analysis.level === 'HIGH') {
        // Acknowledge older moderate alerts (> 24h ago) so judges see both active & acknowledged history
        const isOld = pt.hoursAgo > 24;
        db.prepare(
          `INSERT INTO alerts (
            reading_id, created_at, severity, title, triggered_metrics,
            reason, guidance, acknowledged, acknowledged_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          readingId,
          recordedAt,
          analysis.level,
          analysis.title,
          JSON.stringify(analysis.triggeredFactors),
          analysis.summary,
          analysis.nextSteps.join(' '),
          isOld ? 1 : 0,
          isOld ? new Date(now - (pt.hoursAgo - 2) * hourMs).toISOString() : null,
        );
      }
    }
  }

  const msgCount = db
    .prepare('SELECT COUNT(*) as count FROM assistant_messages')
    .get() as { count: number };

  if (msgCount.count === 0) {
    db.prepare(
      'INSERT INTO assistant_messages (created_at, role, content, context_summary) VALUES (?, ?, ?, ?)',
    ).run(
      new Date().toISOString(),
      'assistant',
      'ASTROCARE AI Assistant ready. I analyze Alex Morgan\'s stored simulated telemetry readings and alert history without inventing measurements or making medical diagnoses. Ask about current SpO2, heart rate changes, sleep trends, or which readings to monitor.',
      'Initialized from local SQLite telemetry.',
    );
  }
}

export function getProfile(): AstronautProfile {
  return db.prepare('SELECT * FROM astronaut_profile WHERE id = 1').get() as AstronautProfile;
}

export function getThresholds(): RiskThresholds {
  const row = db
    .prepare('SELECT config_json, updated_at FROM risk_thresholds WHERE id = 1')
    .get() as { config_json: string; updated_at: string } | undefined;

  if (!row) return { ...DEFAULT_THRESHOLDS };
  const parsed = JSON.parse(row.config_json) as RiskThresholds;
  return { ...DEFAULT_THRESHOLDS, ...parsed, updated_at: row.updated_at };
}

export function saveThresholds(next: RiskThresholds): RiskThresholds {
  const now = new Date().toISOString();
  const payload: RiskThresholds = { ...next, updated_at: now };
  db.prepare('UPDATE risk_thresholds SET config_json = ?, updated_at = ? WHERE id = 1').run(
    JSON.stringify(payload),
    now,
  );
  return payload;
}

export function resetThresholds(): RiskThresholds {
  return saveThresholds({ ...DEFAULT_THRESHOLDS });
}

export function getHistory(limit = 60, hours?: number): HealthReading[] {
  if (hours && Number.isFinite(hours)) {
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    return db
      .prepare(
        'SELECT * FROM health_readings WHERE recorded_at >= ? ORDER BY datetime(recorded_at) DESC, id DESC LIMIT ?',
      )
      .all(cutoff, limit) as HealthReading[];
  }
  return db
    .prepare('SELECT * FROM health_readings ORDER BY datetime(recorded_at) DESC, id DESC LIMIT ?')
    .all(limit) as HealthReading[];
}

export function getCurrentReadingWithAnalysis(): {
  profile: AstronautProfile;
  current: HealthReading | null;
  previous: HealthReading | null;
  analysis: RiskAnalysisResult | null;
  thresholds: RiskThresholds;
  unacknowledgedCount: number;
} {
  const profile = getProfile();
  const thresholds = getThresholds();
  const recent = getHistory(8);
  const current = recent[0] ?? null;
  const previous = recent[1] ?? null;
  const analysis = current
    ? analyzeReading(current, recent.slice(1), thresholds)
    : null;
  const countRow = db
    .prepare('SELECT COUNT(*) as count FROM alerts WHERE acknowledged = 0')
    .get() as { count: number };

  return {
    profile,
    current,
    previous,
    analysis,
    thresholds,
    unacknowledgedCount: countRow.count,
  };
}

const insertReadingTx = db.transaction((input: HealthReadingInput) => {
  const recordedAt = input.recorded_at || new Date().toISOString();
  const source = input.source || 'manual_entry';
  const recent = getHistory(6);
  const thresholds = getThresholds();
  const analysis = analyzeReading(input, recent, thresholds);

  const info = db
    .prepare(
      `INSERT INTO health_readings (
        recorded_at, heart_rate, spo2, systolic_bp, diastolic_bp,
        body_temp_c, sleep_hours, activity_level, source, risk_level, risk_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      recordedAt,
      input.heart_rate,
      input.spo2,
      input.systolic_bp,
      input.diastolic_bp,
      input.body_temp_c,
      input.sleep_hours,
      input.activity_level,
      source,
      analysis.level,
      analysis.summary,
    );

  const readingId = Number(info.lastInsertRowid);
  const reading = db
    .prepare('SELECT * FROM health_readings WHERE id = ?')
    .get(readingId) as HealthReading;

  let createdAlert: AlertRecord | null = null;
  if (analysis.level === 'MODERATE' || analysis.level === 'HIGH') {
    const alertInfo = db
      .prepare(
        `INSERT INTO alerts (
          reading_id, created_at, severity, title, triggered_metrics,
          reason, guidance, acknowledged, acknowledged_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      )
      .run(
        readingId,
        recordedAt,
        analysis.level,
        analysis.title,
        JSON.stringify(analysis.triggeredFactors),
        analysis.summary,
        analysis.nextSteps.join(' '),
      );

    const alertRow = db
      .prepare('SELECT * FROM alerts WHERE id = ?')
      .get(Number(alertInfo.lastInsertRowid)) as Record<string, unknown>;
    createdAlert = mapAlertRow(alertRow);
  }

  return { reading, analysis, alert: createdAlert };
});

export function insertReadingAndEvaluate(input: HealthReadingInput): {
  reading: HealthReading;
  analysis: RiskAnalysisResult;
  alert: AlertRecord | null;
} {
  return insertReadingTx(input);
}

/**
 * Generates one realistic simulated live reading anchored around recent baseline
 * with occasional realistic variations so judges can observe live updates.
 */
export function generateSimulatedTick(): {
  reading: HealthReading;
  analysis: RiskAnalysisResult;
  alert: AlertRecord | null;
} {
  const recent = getHistory(1);
  const last = recent[0];
  const baseHr = last ? last.heart_rate : 72;
  const baseSpo2 = last ? last.spo2 : 98.0;
  const baseSys = last ? last.systolic_bp : 118;
  const baseDia = last ? last.diastolic_bp : 76;
  const baseTemp = last ? last.body_temp_c : 36.7;
  const baseSleep = last ? last.sleep_hours : 6.8;

  // Small bounded physiological drift + occasional mild dip for demo interest
  const roll = Math.random();
  let activity: ActivityLevel = 'Light';
  let hrDelta = Math.round((Math.random() - 0.48) * 6);
  let spo2Delta = (Math.random() - 0.48) * 0.6;

  if (roll > 0.88) {
    activity = 'Moderate';
    hrDelta = 12;
  } else if (roll < 0.08) {
    activity = 'Rest';
    spo2Delta = -1.8;
  }

  const clamp = (val: number, min: number, max: number) =>
    Math.min(max, Math.max(min, val));

  const nextInput: HealthReadingInput = {
    heart_rate: Math.round(clamp(baseHr * 0.7 + 72 * 0.3 + hrDelta, 54, 132)),
    spo2: Math.round(clamp(baseSpo2 * 0.6 + 98.0 * 0.4 + spo2Delta, 90.5, 99.5) * 10) / 10,
    systolic_bp: Math.round(clamp(baseSys * 0.7 + 118 * 0.3 + (Math.random() - 0.5) * 6, 98, 148)),
    diastolic_bp: Math.round(clamp(baseDia * 0.7 + 76 * 0.3 + (Math.random() - 0.5) * 4, 62, 92)),
    body_temp_c: Math.round(clamp(baseTemp * 0.7 + 36.7 * 0.3 + (Math.random() - 0.5) * 0.2, 36.1, 37.8) * 10) / 10,
    sleep_hours: Math.round(clamp(baseSleep + (Math.random() - 0.5) * 0.2, 4.8, 8.5) * 10) / 10,
    activity_level: activity,
    source: 'simulated_live',
  };

  return insertReadingAndEvaluate(nextInput);
}

function mapAlertRow(row: Record<string, unknown>): AlertRecord {
  return {
    id: Number(row.id),
    reading_id: Number(row.reading_id),
    created_at: String(row.created_at),
    severity: String(row.severity) as RiskLevel,
    title: String(row.title),
    triggered_metrics: JSON.parse(String(row.triggered_metrics || '[]')),
    reason: String(row.reason),
    guidance: String(row.guidance),
    acknowledged: Number(row.acknowledged) === 1,
    acknowledged_at: row.acknowledged_at ? String(row.acknowledged_at) : null,
  };
}

export function getAlerts(severity?: string, acknowledgedFilter?: string): AlertRecord[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (severity && ['LOW', 'MODERATE', 'HIGH'].includes(severity.toUpperCase())) {
    clauses.push('severity = ?');
    params.push(severity.toUpperCase());
  }
  if (acknowledgedFilter === 'unacknowledged') {
    clauses.push('acknowledged = 0');
  } else if (acknowledgedFilter === 'acknowledged') {
    clauses.push('acknowledged = 1');
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM alerts ${where} ORDER BY datetime(created_at) DESC, id DESC LIMIT 100`)
    .all(...params) as Record<string, unknown>[];

  return rows.map(mapAlertRow);
}

export function acknowledgeAlert(id: number): AlertRecord | null {
  const existing = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) return null;

  const now = new Date().toISOString();
  db.prepare('UPDATE alerts SET acknowledged = 1, acknowledged_at = ? WHERE id = ?').run(now, id);
  const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as Record<string, unknown>;
  return mapAlertRow(updated);
}

export function getAnalytics(): {
  readings24h: HealthReading[];
  daily7d: Array<{
    day: string;
    avg_hr: number;
    avg_spo2: number;
    avg_systolic: number;
    avg_diastolic: number;
    avg_temp: number;
    avg_sleep: number;
    count: number;
  }>;
  alertCounts: {
    total: number;
    unacknowledged: number;
    high: number;
    moderate: number;
    acknowledged: number;
  };
  alertTimeline: Array<{
    day: string;
    high: number;
    moderate: number;
  }>;
  summary: {
    avg24hHr: number;
    avg24hSpo2: number;
    avg7dSleep: number;
    latestSleep: number;
    sleepDeltaVs7d: number;
    totalReadings: number;
  };
} {
  const all7d = getHistory(500, 24 * 7).slice().reverse();
  const readings24h = getHistory(100, 24).slice().reverse();
  const alerts = getAlerts();

  // Group by UTC date YYYY-MM-DD for 7-day trends
  const dayBuckets = new Map<string, HealthReading[]>();
  for (const r of all7d) {
    const day = r.recorded_at.slice(0, 10);
    const arr = dayBuckets.get(day) || [];
    arr.push(r);
    dayBuckets.set(day, arr);
  }

  const daily7d = Array.from(dayBuckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, list]) => {
      const avg = (fn: (item: HealthReading) => number) =>
        Math.round((list.reduce((s, x) => s + fn(x), 0) / list.length) * 10) / 10;
      return {
        day,
        avg_hr: avg((x) => x.heart_rate),
        avg_spo2: avg((x) => x.spo2),
        avg_systolic: avg((x) => x.systolic_bp),
        avg_diastolic: avg((x) => x.diastolic_bp),
        avg_temp: avg((x) => x.body_temp_c),
        avg_sleep: avg((x) => x.sleep_hours),
        count: list.length,
      };
    });

  const alertDayMap = new Map<string, { high: number; moderate: number }>();
  for (const d of daily7d) {
    alertDayMap.set(d.day, { high: 0, moderate: 0 });
  }
  for (const a of alerts) {
    const day = a.created_at.slice(0, 10);
    const entry = alertDayMap.get(day) || { high: 0, moderate: 0 };
    if (a.severity === 'HIGH') entry.high += 1;
    if (a.severity === 'MODERATE') entry.moderate += 1;
    alertDayMap.set(day, entry);
  }

  const alertTimeline = Array.from(alertDayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, counts]) => ({ day, ...counts }));

  const source24 = readings24h.length > 0 ? readings24h : all7d;
  const avg24hHr =
    source24.length > 0
      ? Math.round((source24.reduce((s, r) => s + r.heart_rate, 0) / source24.length) * 10) / 10
      : 0;
  const avg24hSpo2 =
    source24.length > 0
      ? Math.round((source24.reduce((s, r) => s + r.spo2, 0) / source24.length) * 10) / 10
      : 0;
  const avg7dSleep =
    all7d.length > 0
      ? Math.round((all7d.reduce((s, r) => s + r.sleep_hours, 0) / all7d.length) * 10) / 10
      : 0;
  const latestSleep =
    all7d.length > 0 ? all7d[all7d.length - 1].sleep_hours : 0;

  const totalCountRow = db
    .prepare('SELECT COUNT(*) as count FROM health_readings')
    .get() as { count: number };

  return {
    readings24h,
    daily7d,
    alertCounts: {
      total: alerts.length,
      unacknowledged: alerts.filter((a) => !a.acknowledged).length,
      high: alerts.filter((a) => a.severity === 'HIGH').length,
      moderate: alerts.filter((a) => a.severity === 'MODERATE').length,
      acknowledged: alerts.filter((a) => a.acknowledged).length,
    },
    alertTimeline,
    summary: {
      avg24hHr,
      avg24hSpo2,
      avg7dSleep,
      latestSleep,
      sleepDeltaVs7d: Math.round((latestSleep - avg7dSleep) * 10) / 10,
      totalReadings: totalCountRow.count,
    },
  };
}

export function getAssistantMessages(): Array<{
  id: number;
  created_at: string;
  role: string;
  content: string;
  context_summary: string | null;
}> {
  return db
    .prepare('SELECT * FROM assistant_messages ORDER BY id ASC LIMIT 60')
    .all() as Array<{
    id: number;
    created_at: string;
    role: string;
    content: string;
    context_summary: string | null;
  }>;
}

export function saveAssistantMessage(
  role: 'user' | 'assistant',
  content: string,
  contextSummary: string,
): void {
  db.prepare(
    'INSERT INTO assistant_messages (created_at, role, content, context_summary) VALUES (?, ?, ?, ?)',
  ).run(new Date().toISOString(), role, content, contextSummary);
}
