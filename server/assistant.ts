import { GoogleGenAI } from '@google/genai';
import {
  getAlerts,
  getAnalytics,
  getCurrentReadingWithAnalysis,
  getHistory,
  getProfile,
} from './db.ts';
import type { AlertRecord, AstronautProfile, HealthReading } from './types.ts';

interface GroundedContext {
  profile: AstronautProfile;
  current: NonNullable<ReturnType<typeof getCurrentReadingWithAnalysis>['current']>;
  analysis: ReturnType<typeof getCurrentReadingWithAnalysis>['analysis'];
  thresholds: ReturnType<typeof getCurrentReadingWithAnalysis>['thresholds'];
  yesterdayAvgHr: number | null;
  yesterdayAvgSpo2: number | null;
  yesterdaySleep: number | null;
  avg24hHr: number;
  avg24hSpo2: number;
  avg7dSleep: number;
  sleepDeltaVs7d: number;
  totalReadings: number;
  recentReadings: HealthReading[];
  daily7d: ReturnType<typeof getAnalytics>['daily7d'];
  ranges7d: {
    hrMin: number;
    hrMax: number;
    spo2Min: number;
    spo2Max: number;
    systolicMin: number;
    systolicMax: number;
    tempMin: number;
    tempMax: number;
    sleepMin: number;
    sleepMax: number;
  };
  activeAlertsCount: number;
  recentAlerts: AlertRecord[];
  latestAlertTitle: string | null;
}

function gatherTelemetryContext(): GroundedContext | null {
  const state = getCurrentReadingWithAnalysis();
  if (!state.current) return null;

  const profile = state.profile || getProfile();
  const history = getHistory(120, 24 * 7);
  const analytics = getAnalytics();
  const allAlerts = getAlerts();
  const activeAlerts = allAlerts.filter((a) => !a.acknowledged);

  const now = Date.now();
  const yesterdayReadings = history.filter((r) => {
    const ageH = (now - new Date(r.recorded_at).getTime()) / (3600 * 1000);
    return ageH >= 20 && ageH <= 44;
  });

  const avg = (arr: number[]) =>
    arr.length > 0
      ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10
      : null;

  const sourceForRanges = history.length > 0 ? history : [state.current];
  const minOf = (fn: (r: HealthReading) => number) => Math.min(...sourceForRanges.map(fn));
  const maxOf = (fn: (r: HealthReading) => number) => Math.max(...sourceForRanges.map(fn));

  return {
    profile,
    current: state.current,
    analysis: state.analysis,
    thresholds: state.thresholds,
    yesterdayAvgHr: avg(yesterdayReadings.map((r) => r.heart_rate)),
    yesterdayAvgSpo2: avg(yesterdayReadings.map((r) => r.spo2)),
    yesterdaySleep: avg(yesterdayReadings.map((r) => r.sleep_hours)),
    avg24hHr: analytics.summary.avg24hHr,
    avg24hSpo2: analytics.summary.avg24hSpo2,
    avg7dSleep: analytics.summary.avg7dSleep,
    sleepDeltaVs7d: analytics.summary.sleepDeltaVs7d,
    totalReadings: analytics.summary.totalReadings,
    recentReadings: history.slice(0, 8),
    daily7d: analytics.daily7d,
    ranges7d: {
      hrMin: minOf((r) => r.heart_rate),
      hrMax: maxOf((r) => r.heart_rate),
      spo2Min: Math.round(minOf((r) => r.spo2) * 10) / 10,
      spo2Max: Math.round(maxOf((r) => r.spo2) * 10) / 10,
      systolicMin: minOf((r) => r.systolic_bp),
      systolicMax: maxOf((r) => r.systolic_bp),
      tempMin: Math.round(minOf((r) => r.body_temp_c) * 10) / 10,
      tempMax: Math.round(maxOf((r) => r.body_temp_c) * 10) / 10,
      sleepMin: Math.round(minOf((r) => r.sleep_hours) * 10) / 10,
      sleepMax: Math.round(maxOf((r) => r.sleep_hours) * 10) / 10,
    },
    activeAlertsCount: activeAlerts.length,
    recentAlerts: allAlerts.slice(0, 5),
    latestAlertTitle: activeAlerts[0]?.title ?? null,
  };
}

function formatSigned(value: number, decimals = 0, unit = ''): string {
  const rounded = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${rounded}${unit}`;
}

export function buildDeterministicReply(question: string, ctx: GroundedContext): string {
  const q = question.toLowerCase();
  const cur = ctx.current;
  const t = ctx.thresholds;
  const name = ctx.profile?.name || 'Alex Morgan';

  if (q.includes('spo2') || q.includes('oxygen')) {
    const status =
      cur.spo2 <= t.spo2_high_min
        ? `below the ${t.spo2_high_min}% demonstration high-alert floor`
        : cur.spo2 <= t.spo2_mod_min
          ? `below the ${t.spo2_mod_min}% demonstration moderate-watch floor`
          : `in the comfortable demonstration range (above ${t.spo2_mod_min}%)`;
    const deltaNote =
      ctx.avg24hSpo2 > 0
        ? ` Compared with your 24-hour average of ${ctx.avg24hSpo2.toFixed(1)}%, the latest reading is ${formatSigned(cur.spo2 - ctx.avg24hSpo2, 1, '%')}.`
        : '';

    return [
      `In simple terms, SpO2 estimates how much oxygen your red blood cells are carrying. ${name}'s latest simulated SpO2 is ${cur.spo2.toFixed(1)}% (recorded during "${cur.activity_level}"), which is ${status}.${deltaNote}`,
      `Across your stored 7-day history (${ctx.totalReadings} total readings), SpO2 has ranged between ${ctx.ranges7d.spo2Min.toFixed(1)}% and ${ctx.ranges7d.spo2Max.toFixed(1)}%. Short dips in demo telemetry can happen when a finger sensor shifts, during exertion, or when cabin air mixes.`,
      `Next step: if a reading drops below ${t.spo2_mod_min}%, pause activity, check sensor fit, and re-test after a few calm breaths. (Simulated demonstration telemetry only — not a medical diagnosis or live NASA medical feed.)`,
    ].join('\n\n');
  }

  if (q.includes('heart rate') || q.includes('pulse') || q.includes('bpm') || q.includes('yesterday')) {
    const yestText =
      ctx.yesterdayAvgHr !== null
        ? `Yesterday's stored readings averaged ${ctx.yesterdayAvgHr} bpm, so your latest reading (${cur.heart_rate} bpm) is ${formatSigned(cur.heart_rate - ctx.yesterdayAvgHr, 0, ' bpm')} compared with yesterday.`
        : `There are not enough stored readings from yesterday's 20–44 hour window for a direct comparison, so comparing against your 24-hour average (${ctx.avg24hHr} bpm): the latest reading is ${formatSigned(cur.heart_rate - ctx.avg24hHr, 0, ' bpm')}.`;

    return [
      `${name}'s latest stored heart rate is ${cur.heart_rate} bpm while "${cur.activity_level}" was logged. ${yestText}`,
      `Why it changes: heart rate naturally rises during exercise or EVA prep and settles down during quiet rest. Over the last 7 days in your log, heart rate has ranged from ${ctx.ranges7d.hrMin} to ${ctx.ranges7d.hrMax} bpm. Our demo watch limit starts at ${t.heart_rate_high_mod} bpm at rest (and shifts +25 bpm higher during Exercise or EVA Prep).`,
      `Next step: look at your activity tag and sleep (${cur.sleep_hours.toFixed(1)} hrs logged) together—if resting heart rate stays high after 10–15 minutes of calm rest, review the Risk & Alerts tab. (Simulated data only; not a clinical diagnosis.)`,
    ].join('\n\n');
  }

  if (q.includes('sleep') || q.includes('rest') || q.includes('fatigue')) {
    const dir =
      ctx.sleepDeltaVs7d >= 0
        ? `${formatSigned(ctx.sleepDeltaVs7d, 1, ' hrs')} above`
        : `${Math.abs(ctx.sleepDeltaVs7d).toFixed(1)} hrs below`;
    const yestSleep =
      ctx.yesterdaySleep !== null
        ? ` Yesterday's logged sleep averaged ${ctx.yesterdaySleep.toFixed(1)} hrs.`
        : '';
    const floorStatus =
      cur.sleep_hours <= t.sleep_mod_min
        ? `That sits below the ${t.sleep_mod_min.toFixed(1)} hr demonstration rest target.`
        : `That meets the ${t.sleep_mod_min.toFixed(1)} hr demonstration rest target.`;

    return [
      `Your latest recorded sleep block is ${cur.sleep_hours.toFixed(1)} hrs, which is ${dir} your 7-day stored average of ${ctx.avg7dSleep.toFixed(1)} hrs (7-day range: ${ctx.ranges7d.sleepMin.toFixed(1)}–${ctx.ranges7d.sleepMax.toFixed(1)} hrs).${yestSleep} ${floorStatus}`,
      `In plain English, getting roughly ${t.sleep_drop_mod.toFixed(1)} hrs or more less sleep than your recent routine triggers a Sleep Pattern Change watch because short rest often goes hand-in-hand with a higher resting heart rate the next day.`,
      `Note: This reflects locally stored simulated logs—not live spacecraft sleep hardware or a medical diagnosis.`,
    ].join('\n\n');
  }

  if (q.includes('blood pressure') || q.includes('bp') || q.includes('temperature') || q.includes('temp') || q.includes('fever')) {
    const bpStatus =
      cur.systolic_bp >= t.systolic_mod_high || cur.diastolic_bp >= t.diastolic_mod_high
        ? `above the ${t.systolic_mod_high}/${t.diastolic_mod_high} mmHg demonstration watch line`
        : `within the normal demonstration range (below ${t.systolic_mod_high}/${t.diastolic_mod_high} mmHg)`;
    const tempStatus =
      cur.body_temp_c >= t.temp_mod_high
        ? `slightly above the ${t.temp_mod_high} °C demonstration watch mark`
        : `within the comfortable demonstration range (below ${t.temp_mod_high} °C)`;

    return [
      `Here is a simple read on ${name}'s latest blood pressure and temperature:\n• Blood Pressure: ${cur.systolic_bp}/${cur.diastolic_bp} mmHg — ${bpStatus}. (Top number = pressure when the heart beats; bottom number = pressure between beats.)\n• Body Temperature: ${cur.body_temp_c.toFixed(1)} °C — ${tempStatus}.`,
      `Over the past 7 days of stored readings, systolic BP has ranged from ${ctx.ranges7d.systolicMin} to ${ctx.ranges7d.systolicMax} mmHg and temperature from ${ctx.ranges7d.tempMin.toFixed(1)} to ${ctx.ranges7d.tempMax.toFixed(1)} °C.`,
      `Next step: re-check BP with the cuff level with the heart after sitting quietly for 5 minutes, and re-verify thermistor placement if temperature reads warm. (Simulated demo readings only; not a medical diagnosis.)`,
    ].join('\n\n');
  }

  if (q.includes('alert') || q.includes('trend') || q.includes('history') || q.includes('warning')) {
    const alertLines =
      ctx.recentAlerts.length > 0
        ? ctx.recentAlerts
            .slice(0, 3)
            .map(
              (a) =>
                `• [${a.severity}${a.acknowledged ? ' · Acknowledged' : ' · Open'}] ${a.title} — ${a.reason}`,
            )
            .join('\n')
        : '• No warning alerts are currently stored in the alert log.';

    return [
      `Recent History & 7-Day Trends (${ctx.totalReadings} stored readings):\n• 24h Averages: Heart Rate ${ctx.avg24hHr} bpm, SpO2 ${ctx.avg24hSpo2.toFixed(1)}%\n• 7-Day Ranges: HR ${ctx.ranges7d.hrMin}–${ctx.ranges7d.hrMax} bpm, SpO2 ${ctx.ranges7d.spo2Min.toFixed(1)}–${ctx.ranges7d.spo2Max.toFixed(1)}%, Sleep ${ctx.ranges7d.sleepMin.toFixed(1)}–${ctx.ranges7d.sleepMax.toFixed(1)} hrs (avg ${ctx.avg7dSleep.toFixed(1)} hrs)`,
      `Smart Alert Log (${ctx.activeAlertsCount} open / unacknowledged):\n${alertLines}`,
      `In plain English, open alerts highlight readings that crossed our prototype demonstration limits or shifted sharply from your recent average. Review and acknowledge open alerts in the Risk & Alerts view after re-checking sensors. (ASTROCARE AI uses local simulated data only and has no access to live NASA medical systems.)`,
    ].join('\n\n');
  }

  if (q.includes('monitor') || q.includes('watch') || q.includes('priority')) {
    const factors = ctx.analysis?.triggeredFactors ?? [];
    if (factors.length > 0) {
      const list = factors
        .map((f) => `• ${f.label}: measured ${f.observed} (demo limit: ${f.threshold_reference})`)
        .join('\n');
      return [
        `Right now, the Risk Engine is at ${ctx.analysis?.level} status. Here are the measurements to watch closely:\n${list}`,
        `There are ${ctx.activeAlertsCount} unacknowledged alert(s) waiting in the Smart Alert Center${ctx.latestAlertTitle ? ` (most recent: "${ctx.latestAlertTitle}")` : ''}. Double-check sensor contact, note whether you just finished exercise, and re-measure after calm rest.`,
        `Reminder: ASTROCARE AI uses simulated readings and demonstration rules—it does not diagnose diseases or connect to live NASA medical systems.`,
      ].join('\n\n');
    }

    return [
      `Good news: all 5 monitored vitals in ${name}'s latest reading are currently in LOW (nominal) status — HR ${cur.heart_rate} bpm, SpO2 ${cur.spo2.toFixed(1)}%, BP ${cur.systolic_bp}/${cur.diastolic_bp} mmHg, Temp ${cur.body_temp_c.toFixed(1)} °C, Sleep ${cur.sleep_hours.toFixed(1)} hrs.`,
      ctx.activeAlertsCount > 0
        ? `Even though the latest check is calm, there are still ${ctx.activeAlertsCount} earlier unacknowledged alert(s) in the Alert Center (latest: "${ctx.latestAlertTitle}") worth reviewing.`
        : `Keep tracking your 24-hour averages (HR ${ctx.avg24hHr} bpm, SpO2 ${ctx.avg24hSpo2.toFixed(1)}%) and sleep routine (7-day avg ${ctx.avg7dSleep.toFixed(1)} hrs).`,
    ].join('\n\n');
  }

  // General simple-English summary grounded strictly in stored values & history
  return [
    `Here is a plain-English summary of ${name}'s latest stored reading (${new Date(cur.recorded_at).toLocaleString()} during ${cur.activity_level}):\n• Heart Rate: ${cur.heart_rate} bpm (24h avg ${ctx.avg24hHr} bpm)\n• SpO2 (Oxygen): ${cur.spo2.toFixed(1)}% (24h avg ${ctx.avg24hSpo2.toFixed(1)}%)\n• Blood Pressure: ${cur.systolic_bp}/${cur.diastolic_bp} mmHg · Temp: ${cur.body_temp_c.toFixed(1)} °C\n• Sleep: ${cur.sleep_hours.toFixed(1)} hrs (7-day avg ${ctx.avg7dSleep.toFixed(1)} hrs)`,
    `Overall Status: ${ctx.analysis?.level ?? 'LOW'} — ${ctx.analysis?.summary ?? 'All readings within demonstration bounds.'} Open alerts: ${ctx.activeAlertsCount}. (Based strictly on locally stored simulated telemetry; not a medical diagnosis or live NASA medical system.)`,
  ].join('\n\n');
}

export async function generateAssistantReply(question: string): Promise<{
  reply: string;
  mode: 'gemini' | 'deterministic';
  contextSummary: string;
}> {
  const ctx = gatherTelemetryContext();
  if (!ctx) {
    return {
      reply:
        'No telemetry readings are currently stored in the database. Log a reading or start the simulated telemetry stream first so I can review Alex Morgan\'s readings and history.',
      mode: 'deterministic',
      contextSummary: '0 stored readings available.',
    };
  }

  const contextSummary = `Latest: HR ${ctx.current.heart_rate} bpm, SpO2 ${ctx.current.spo2.toFixed(1)}%, BP ${ctx.current.systolic_bp}/${ctx.current.diastolic_bp} mmHg, Temp ${ctx.current.body_temp_c.toFixed(1)} °C, Sleep ${ctx.current.sleep_hours.toFixed(1)} hrs (${ctx.current.activity_level}) · 7d Avg Sleep: ${ctx.avg7dSleep.toFixed(1)} hrs · Status: ${ctx.analysis?.level ?? 'LOW'} · Open Alerts: ${ctx.activeAlertsCount}`;

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const hasRealKey = apiKey.length > 10 && !apiKey.startsWith('MY_');

  if (hasRealKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const promptContext = JSON.stringify(
        {
          systemBoundary:
            'Locally stored simulated demonstration telemetry only. No access to live NASA medical systems or flight hardware.',
          astronaut: {
            name: ctx.profile.name,
            callsign: ctx.profile.callsign,
            missionName: ctx.profile.mission_name,
            missionDay: ctx.profile.mission_day,
            missionDurationDays: ctx.profile.mission_duration_days,
          },
          latestReading: ctx.current,
          riskAnalysis: {
            level: ctx.analysis?.level,
            title: ctx.analysis?.title,
            summary: ctx.analysis?.summary,
            triggeredFactors: ctx.analysis?.triggeredFactors,
            nextSteps: ctx.analysis?.nextSteps,
          },
          demonstrationThresholds: ctx.thresholds,
          averagesAndRanges: {
            totalStoredReadings: ctx.totalReadings,
            avg24hHeartRateBpm: ctx.avg24hHr,
            avg24hSpo2Pct: ctx.avg24hSpo2,
            yesterdayAvgHeartRateBpm: ctx.yesterdayAvgHr,
            yesterdayAvgSpo2Pct: ctx.yesterdayAvgSpo2,
            yesterdayAvgSleepHrs: ctx.yesterdaySleep,
            avg7dSleepHrs: ctx.avg7dSleep,
            sleepDeltaVs7dHrs: ctx.sleepDeltaVs7d,
            ranges7d: ctx.ranges7d,
          },
          daily7dHistory: ctx.daily7d,
          recentStoredReadings: ctx.recentReadings.map((r) => ({
            recorded_at: r.recorded_at,
            heart_rate: r.heart_rate,
            spo2: r.spo2,
            bp: `${r.systolic_bp}/${r.diastolic_bp}`,
            body_temp_c: r.body_temp_c,
            sleep_hours: r.sleep_hours,
            activity_level: r.activity_level,
            risk_level: r.risk_level,
          })),
          alertsSummary: {
            unacknowledgedCount: ctx.activeAlertsCount,
            recentAlerts: ctx.recentAlerts.map((a) => ({
              created_at: a.created_at,
              severity: a.severity,
              title: a.title,
              reason: a.reason,
              acknowledged: a.acknowledged,
            })),
          },
        },
        null,
        2,
      );

      const geminiPromise = ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Astronaut question: "${question}"\n\nStored Telemetry & History Context (JSON):\n${promptContext}`,
        config: {
          systemInstruction:
            'You are the ASTROCARE AI Health Assistant. Answer in simple, clear everyday English (90–160 words) so measurements, trends, and alerts are easy to understand. Strict rules: 1) Use ONLY the numbers, trends, and alerts in the provided JSON. Never invent, estimate, or extrapolate missing readings (if a window is null, state that clearly). 2) Never diagnose diseases or provide clinical medical diagnoses. 3) Never claim access to live NASA medical systems or real spacecraft sensors—treat all data as simulated demonstration telemetry with configurable demo thresholds. 4) Offer practical, plain-English next-step monitoring reminders.',
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Gemini assistant timeout')), 7000);
      });

      const response = await Promise.race([geminiPromise, timeoutPromise]);

      const text = (response.text || '').trim();
      if (text.length > 0) {
        return {
          reply: text,
          mode: 'gemini',
          contextSummary,
        };
      }
    } catch (err) {
      console.warn('Gemini assistant call failed, using deterministic grounded fallback:', err);
    }
  }

  return {
    reply: buildDeterministicReply(question, ctx),
    mode: 'deterministic',
    contextSummary,
  };
}

