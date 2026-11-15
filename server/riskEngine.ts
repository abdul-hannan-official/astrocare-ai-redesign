import type {
  ActivityLevel,
  HealthReading,
  HealthReadingInput,
  RiskAnalysisResult,
  RiskLevel,
  RiskThresholds,
  TriggeredFactor,
} from './types.ts';

/**
 * Default demonstration thresholds for ASTROCARE AI.
 * IMPORTANT: These are demonstration thresholds for hackathon/prototype evaluation
 * and are NOT medically validated astronaut flight standards.
 */
export const DEFAULT_THRESHOLDS: RiskThresholds = {
  heart_rate_low_mod: 48,
  heart_rate_high_mod: 100,
  heart_rate_high_crit: 118,
  spo2_mod_min: 94,
  spo2_high_min: 91,
  systolic_mod_high: 135,
  systolic_crit_high: 150,
  systolic_mod_low: 90,
  diastolic_mod_high: 88,
  diastolic_crit_high: 96,
  temp_mod_high: 37.5,
  temp_crit_high: 38.2,
  temp_mod_low: 35.8,
  sleep_mod_min: 6.0,
  sleep_high_min: 4.5,
  sleep_drop_mod: 1.5,
  hr_delta_mod: 22,
  spo2_drop_mod: 3.0,
};

export const VALID_ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  'Rest',
  'Light',
  'Moderate',
  'EVA Prep',
  'Exercise',
];

export const THRESHOLD_DISCLAIMER =
  'Demonstration thresholds only — not medically validated NASA flight standards. ASTROCARE AI is a monitoring prototype, not a clinically validated medical device, and does not diagnose diseases.';

export const THRESHOLD_LIMITATIONS: string[] = [
  'Static demonstration ranges do not account for individual astronaut baselines, age, or mission-phase adaptation.',
  'Microgravity fluid shifts and circadian misalignment naturally alter cardiovascular and sleep metrics over time.',
  'Motion artifacts, loose pulse-oximeter contact, or cabin environmental shifts can cause transient non-clinical readings.',
  'Not a clinically validated medical device; all alerts require verification and human medical officer oversight.',
];

function parseStrictNumber(val: unknown): number {
  if (val === null || val === undefined || typeof val === 'boolean') return Number.NaN;
  if (typeof val === 'string' && val.trim() === '') return Number.NaN;
  const num = Number(val);
  return Number.isFinite(num) ? num : Number.NaN;
}

/**
 * Validates incoming vital sign payloads before saving to SQLite.
 * Returns normalized HealthReadingInput or a structured list of validation errors.
 */
export function validateReadingInput(raw: unknown): {
  valid: boolean;
  errors: string[];
  data?: HealthReadingInput;
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Request body must be a JSON object.'] };
  }

  const input = raw as Record<string, unknown>;
  const errors: string[] = [];

  const hr = parseStrictNumber(input.heart_rate);
  const spo2 = parseStrictNumber(input.spo2);
  const sys = parseStrictNumber(input.systolic_bp);
  const dia = parseStrictNumber(input.diastolic_bp);
  const temp = parseStrictNumber(input.body_temp_c);
  const sleep = parseStrictNumber(input.sleep_hours);
  const activity = String(input.activity_level || '').trim() as ActivityLevel;

  if (!Number.isFinite(hr) || hr < 30 || hr > 220) {
    errors.push('Heart rate must be a number between 30 and 220 bpm.');
  }
  if (!Number.isFinite(spo2) || spo2 < 70 || spo2 > 100) {
    errors.push('SpO2 must be a number between 70 and 100%.');
  }
  if (!Number.isFinite(sys) || sys < 60 || sys > 240) {
    errors.push('Systolic blood pressure must be between 60 and 240 mmHg.');
  }
  if (!Number.isFinite(dia) || dia < 40 || dia > 150) {
    errors.push('Diastolic blood pressure must be between 40 and 150 mmHg.');
  }
  if (Number.isFinite(sys) && Number.isFinite(dia) && dia >= sys) {
    errors.push('Diastolic blood pressure must be lower than systolic blood pressure.');
  }
  if (!Number.isFinite(temp) || temp < 33.0 || temp > 42.5) {
    errors.push('Body temperature must be between 33.0 and 42.5 °C.');
  }
  if (!Number.isFinite(sleep) || sleep < 0 || sleep > 16) {
    errors.push('Sleep duration must be between 0 and 16 hours.');
  }
  if (!VALID_ACTIVITY_LEVELS.includes(activity)) {
    errors.push(`Activity level must be one of: ${VALID_ACTIVITY_LEVELS.join(', ')}.`);
  }

  let normalizedDate: string | undefined;
  if (input.recorded_at !== undefined) {
    if (typeof input.recorded_at !== 'string' || Number.isNaN(Date.parse(input.recorded_at))) {
      errors.push('recorded_at must be a valid ISO-8601 date string.');
    } else {
      normalizedDate = new Date(input.recorded_at).toISOString();
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      heart_rate: Math.round(hr),
      spo2: Math.round(spo2 * 10) / 10,
      systolic_bp: Math.round(sys),
      diastolic_bp: Math.round(dia),
      body_temp_c: Math.round(temp * 10) / 10,
      sleep_hours: Math.round(sleep * 10) / 10,
      activity_level: activity,
      source:
        input.source === 'simulated_live' || input.source === 'simulated_seed'
          ? input.source
          : 'manual_entry',
      recorded_at: normalizedDate,
    },
  };
}

/**
 * Validates and merges partial threshold updates against current thresholds.
 */
export function validateThresholdUpdates(
  raw: unknown,
  current: RiskThresholds,
): { valid: boolean; errors: string[]; thresholds?: RiskThresholds } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Threshold payload must be a JSON object.'] };
  }

  const input = raw as Record<string, unknown>;
  const next: RiskThresholds = { ...current };
  const numericBounds: Array<{ key: keyof RiskThresholds; min: number; max: number }> = [
    { key: 'heart_rate_low_mod', min: 30, max: 120 },
    { key: 'heart_rate_high_mod', min: 50, max: 200 },
    { key: 'heart_rate_high_crit', min: 60, max: 220 },
    { key: 'spo2_mod_min', min: 75, max: 99 },
    { key: 'spo2_high_min', min: 70, max: 98 },
    { key: 'systolic_mod_high', min: 90, max: 220 },
    { key: 'systolic_crit_high', min: 100, max: 240 },
    { key: 'systolic_mod_low', min: 60, max: 120 },
    { key: 'diastolic_mod_high', min: 50, max: 140 },
    { key: 'diastolic_crit_high', min: 60, max: 150 },
    { key: 'temp_mod_high', min: 35.0, max: 41.0 },
    { key: 'temp_crit_high', min: 36.0, max: 42.5 },
    { key: 'temp_mod_low', min: 33.0, max: 37.0 },
    { key: 'sleep_mod_min', min: 1, max: 12 },
    { key: 'sleep_high_min', min: 0, max: 10 },
    { key: 'sleep_drop_mod', min: 0.5, max: 6 },
    { key: 'hr_delta_mod', min: 5, max: 80 },
    { key: 'spo2_drop_mod', min: 0.5, max: 20 },
  ];

  const errors: string[] = [];
  for (const { key, min, max } of numericBounds) {
    if (input[key] !== undefined) {
      const val = parseStrictNumber(input[key]);
      if (!Number.isFinite(val) || val < min || val > max) {
        errors.push(`Threshold ${key} must be a number between ${min} and ${max}.`);
      } else {
        (next[key] as number) = val;
      }
    }
  }

  if (next.heart_rate_low_mod >= next.heart_rate_high_mod) {
    errors.push('Low heart rate threshold must be below moderate high heart rate threshold.');
  }
  if (next.heart_rate_high_mod >= next.heart_rate_high_crit) {
    errors.push('Moderate high heart rate threshold must be below high alert heart rate threshold.');
  }
  if (next.spo2_high_min >= next.spo2_mod_min) {
    errors.push('High-alert SpO2 floor must be lower than moderate SpO2 floor.');
  }
  if (next.systolic_mod_low >= next.systolic_mod_high || next.systolic_mod_high >= next.systolic_crit_high) {
    errors.push('Systolic thresholds must satisfy low < moderate high < critical high.');
  }
  if (next.diastolic_mod_high >= next.diastolic_crit_high) {
    errors.push('Moderate diastolic threshold must be below critical diastolic threshold.');
  }
  if (next.temp_mod_low >= next.temp_mod_high || next.temp_mod_high >= next.temp_crit_high) {
    errors.push('Temperature thresholds must satisfy low < moderate high < critical high.');
  }
  if (next.sleep_high_min >= next.sleep_mod_min) {
    errors.push('High-alert sleep floor must be lower than moderate sleep floor.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], thresholds: next };
}

function maxSeverity(a: RiskLevel, b: RiskLevel): RiskLevel {
  const rank: Record<RiskLevel, number> = { LOW: 0, MODERATE: 1, HIGH: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Explainable AI Health Risk Engine.
 * Evaluates a vital reading against configurable demonstration thresholds AND
 * compares against recent historical readings to detect sudden physiological shifts.
 * Never claims to diagnose any medical disease.
 */
export function analyzeReading(
  reading: HealthReadingInput,
  recentHistory: HealthReading[] = [],
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS,
): RiskAnalysisResult {
  const factors: TriggeredFactor[] = [];
  let level: RiskLevel = 'LOW';

  const isActiveExertion =
    reading.activity_level === 'Exercise' || reading.activity_level === 'EVA Prep';

  // 1. Blood Oxygen Saturation (SpO2)
  if (reading.spo2 <= thresholds.spo2_high_min) {
    level = maxSeverity(level, 'HIGH');
    factors.push({
      metric: 'spo2',
      label: 'Blood Oxygen Saturation (SpO2)',
      observed: `${reading.spo2.toFixed(1)}%`,
      threshold_reference: `<= ${thresholds.spo2_high_min}% (High Monitoring Threshold)`,
      severity: 'HIGH',
      explanation: `SpO2 dropped to ${reading.spo2.toFixed(1)}%, crossing below the ${thresholds.spo2_high_min}% demonstration high-alert floor.`,
    });
  } else if (reading.spo2 <= thresholds.spo2_mod_min) {
    level = maxSeverity(level, 'MODERATE');
    factors.push({
      metric: 'spo2',
      label: 'Blood Oxygen Saturation (SpO2)',
      observed: `${reading.spo2.toFixed(1)}%`,
      threshold_reference: `<= ${thresholds.spo2_mod_min}% (Moderate Monitoring Threshold)`,
      severity: 'MODERATE',
      explanation: `SpO2 of ${reading.spo2.toFixed(1)}% is below the ${thresholds.spo2_mod_min}% moderate demonstration range.`,
    });
  }

  // 2. Heart Rate (context-aware for exercise vs resting)
  const effectiveHrMod = isActiveExertion
    ? thresholds.heart_rate_high_mod + 25
    : thresholds.heart_rate_high_mod;
  const effectiveHrCrit = isActiveExertion
    ? thresholds.heart_rate_high_crit + 25
    : thresholds.heart_rate_high_crit;

  if (reading.heart_rate >= effectiveHrCrit) {
    level = maxSeverity(level, 'HIGH');
    factors.push({
      metric: 'heart_rate',
      label: 'Heart Rate',
      observed: `${reading.heart_rate} bpm`,
      threshold_reference: `>= ${effectiveHrCrit} bpm (${reading.activity_level} context)`,
      severity: 'HIGH',
      explanation: `Heart rate (${reading.heart_rate} bpm during ${reading.activity_level}) exceeds the high monitoring boundary of ${effectiveHrCrit} bpm.`,
    });
  } else if (reading.heart_rate >= effectiveHrMod) {
    level = maxSeverity(level, 'MODERATE');
    factors.push({
      metric: 'heart_rate',
      label: 'Heart Rate',
      observed: `${reading.heart_rate} bpm`,
      threshold_reference: `>= ${effectiveHrMod} bpm (${reading.activity_level} context)`,
      severity: 'MODERATE',
      explanation: `Heart rate (${reading.heart_rate} bpm during ${reading.activity_level}) is elevated above the ${effectiveHrMod} bpm demonstration threshold.`,
    });
  } else if (reading.heart_rate <= thresholds.heart_rate_low_mod) {
    level = maxSeverity(level, 'MODERATE');
    factors.push({
      metric: 'heart_rate',
      label: 'Heart Rate',
      observed: `${reading.heart_rate} bpm`,
      threshold_reference: `<= ${thresholds.heart_rate_low_mod} bpm (Low Heart Rate Threshold)`,
      severity: 'MODERATE',
      explanation: `Heart rate (${reading.heart_rate} bpm) is below the ${thresholds.heart_rate_low_mod} bpm lower demonstration boundary.`,
    });
  }

  // 3. Blood Pressure (Systolic & Diastolic)
  if (
    reading.systolic_bp >= thresholds.systolic_crit_high ||
    reading.diastolic_bp >= thresholds.diastolic_crit_high
  ) {
    level = maxSeverity(level, 'HIGH');
    factors.push({
      metric: 'blood_pressure',
      label: 'Blood Pressure',
      observed: `${reading.systolic_bp}/${reading.diastolic_bp} mmHg`,
      threshold_reference: `>= ${thresholds.systolic_crit_high}/${thresholds.diastolic_crit_high} mmHg`,
      severity: 'HIGH',
      explanation: `Blood pressure (${reading.systolic_bp}/${reading.diastolic_bp} mmHg) exceeded the high-monitoring demonstration boundary.`,
    });
  } else if (
    reading.systolic_bp >= thresholds.systolic_mod_high ||
    reading.diastolic_bp >= thresholds.diastolic_mod_high
  ) {
    level = maxSeverity(level, 'MODERATE');
    factors.push({
      metric: 'blood_pressure',
      label: 'Blood Pressure',
      observed: `${reading.systolic_bp}/${reading.diastolic_bp} mmHg`,
      threshold_reference: `>= ${thresholds.systolic_mod_high}/${thresholds.diastolic_mod_high} mmHg`,
      severity: 'MODERATE',
      explanation: `Blood pressure (${reading.systolic_bp}/${reading.diastolic_bp} mmHg) is above the moderate demonstration upper range.`,
    });
  } else if (reading.systolic_bp <= thresholds.systolic_mod_low) {
    level = maxSeverity(level, 'MODERATE');
    factors.push({
      metric: 'blood_pressure',
      label: 'Blood Pressure',
      observed: `${reading.systolic_bp}/${reading.diastolic_bp} mmHg`,
      threshold_reference: `<= ${thresholds.systolic_mod_low} mmHg systolic`,
      severity: 'MODERATE',
      explanation: `Systolic pressure (${reading.systolic_bp} mmHg) is below the ${thresholds.systolic_mod_low} mmHg demonstration floor.`,
    });
  }

  // 4. Body Temperature
  if (reading.body_temp_c >= thresholds.temp_crit_high) {
    level = maxSeverity(level, 'HIGH');
    factors.push({
      metric: 'body_temp_c',
      label: 'Body Temperature',
      observed: `${reading.body_temp_c.toFixed(1)} °C`,
      threshold_reference: `>= ${thresholds.temp_crit_high.toFixed(1)} °C`,
      severity: 'HIGH',
      explanation: `Body temperature (${reading.body_temp_c.toFixed(1)} °C) exceeded the ${thresholds.temp_crit_high.toFixed(1)} °C high monitoring limit.`,
    });
  } else if (reading.body_temp_c >= thresholds.temp_mod_high) {
    level = maxSeverity(level, 'MODERATE');
    factors.push({
      metric: 'body_temp_c',
      label: 'Body Temperature',
      observed: `${reading.body_temp_c.toFixed(1)} °C`,
      threshold_reference: `>= ${thresholds.temp_mod_high.toFixed(1)} °C`,
      severity: 'MODERATE',
      explanation: `Body temperature (${reading.body_temp_c.toFixed(1)} °C) is slightly above the ${thresholds.temp_mod_high.toFixed(1)} °C demonstration baseline.`,
    });
  } else if (reading.body_temp_c <= thresholds.temp_mod_low) {
    level = maxSeverity(level, 'MODERATE');
    factors.push({
      metric: 'body_temp_c',
      label: 'Body Temperature',
      observed: `${reading.body_temp_c.toFixed(1)} °C`,
      threshold_reference: `<= ${thresholds.temp_mod_low.toFixed(1)} °C`,
      severity: 'MODERATE',
      explanation: `Body temperature (${reading.body_temp_c.toFixed(1)} °C) is below the ${thresholds.temp_mod_low.toFixed(1)} °C demonstration floor.`,
    });
  }

  // 5. Sleep Duration
  if (reading.sleep_hours <= thresholds.sleep_high_min) {
    level = maxSeverity(level, 'HIGH');
    factors.push({
      metric: 'sleep_hours',
      label: 'Sleep Duration',
      observed: `${reading.sleep_hours.toFixed(1)} hrs`,
      threshold_reference: `<= ${thresholds.sleep_high_min.toFixed(1)} hrs`,
      severity: 'HIGH',
      explanation: `Recorded sleep (${reading.sleep_hours.toFixed(1)} hrs) indicates significant circadian/rest deficit below ${thresholds.sleep_high_min.toFixed(1)} hrs.`,
    });
  } else if (reading.sleep_hours <= thresholds.sleep_mod_min) {
    level = maxSeverity(level, 'MODERATE');
    factors.push({
      metric: 'sleep_hours',
      label: 'Sleep Duration',
      observed: `${reading.sleep_hours.toFixed(1)} hrs`,
      threshold_reference: `<= ${thresholds.sleep_mod_min.toFixed(1)} hrs`,
      severity: 'MODERATE',
      explanation: `Recorded sleep (${reading.sleep_hours.toFixed(1)} hrs) is below the ${thresholds.sleep_mod_min.toFixed(1)} hr demonstration rest target.`,
    });
  }

  // 6. Trend / Sudden Shift Analysis against recent baseline (last up to 6 readings)
  if (recentHistory.length > 0) {
    const sample = recentHistory.slice(0, 6);
    const avgHr = sample.reduce((sum, r) => sum + r.heart_rate, 0) / sample.length;
    const avgSpo2 = sample.reduce((sum, r) => sum + r.spo2, 0) / sample.length;
    const avgSleep = sample.reduce((sum, r) => sum + r.sleep_hours, 0) / sample.length;

    const hrDelta = reading.heart_rate - avgHr;
    if (!isActiveExertion && hrDelta >= thresholds.hr_delta_mod) {
      level = maxSeverity(level, 'MODERATE');
      factors.push({
        metric: 'heart_rate_trend',
        label: 'Heart Rate Pattern Shift',
        observed: `${reading.heart_rate} bpm (+${Math.round(hrDelta)} bpm vs avg ${Math.round(avgHr)} bpm)`,
        threshold_reference: `Delta >= +${thresholds.hr_delta_mod} bpm at rest/light activity`,
        severity: 'MODERATE',
        explanation: `Heart rate jumped ${Math.round(hrDelta)} bpm above the recent rolling average (${Math.round(avgHr)} bpm) without high-exertion activity logged.`,
      });
    }

    const spo2Drop = avgSpo2 - reading.spo2;
    if (spo2Drop >= thresholds.spo2_drop_mod) {
      level = maxSeverity(level, 'MODERATE');
      factors.push({
        metric: 'spo2_trend',
        label: 'SpO2 Baseline Shift',
        observed: `${reading.spo2.toFixed(1)}% (-${spo2Drop.toFixed(1)}% vs avg ${avgSpo2.toFixed(1)}%)`,
        threshold_reference: `Drop >= ${thresholds.spo2_drop_mod.toFixed(1)}%`,
        severity: 'MODERATE',
        explanation: `SpO2 decreased by ${spo2Drop.toFixed(1)} percentage points compared to the recent average of ${avgSpo2.toFixed(1)}%.`,
      });
    }

    const sleepDrop = avgSleep - reading.sleep_hours;
    if (sleepDrop >= thresholds.sleep_drop_mod) {
      level = maxSeverity(level, 'MODERATE');
      factors.push({
        metric: 'sleep_trend',
        label: 'Sleep Pattern Change',
        observed: `${reading.sleep_hours.toFixed(1)} hrs (-${sleepDrop.toFixed(1)} hrs vs avg ${avgSleep.toFixed(1)} hrs)`,
        threshold_reference: `Drop >= ${thresholds.sleep_drop_mod.toFixed(1)} hrs vs recent baseline`,
        severity: 'MODERATE',
        explanation: `Sleep duration dropped ${sleepDrop.toFixed(1)} hrs below the recent baseline average (${avgSleep.toFixed(1)} hrs), indicating an abrupt rest pattern change.`,
      });
    }
  }

  // Build explainable summary and non-diagnostic next-step guidance
  if (level === 'LOW') {
    return {
      level: 'LOW',
      title: 'Nominal Monitoring Status',
      summary:
        'All recorded simulated vitals are within configured demonstration thresholds with no unusual baseline shifts.',
      triggeredFactors: [],
      nextSteps: [
        'Continue routine scheduled telemetry logging and hydration checks.',
        'Maintain standard orbital sleep-wake schedule and countermeasure exercise routine.',
      ],
      limitations: THRESHOLD_LIMITATIONS,
      disclaimer: THRESHOLD_DISCLAIMER,
    };
  }

  const metricNames = Array.from(new Set(factors.map((f) => f.label)));
  const nextSteps = buildNextSteps(factors, level);

  return {
    level,
    title:
      level === 'HIGH'
        ? `High Monitoring Priority: ${metricNames.slice(0, 2).join(' & ')}`
        : `Moderate Monitoring Watch: ${metricNames.slice(0, 2).join(' & ')}`,
    summary: `Detected ${factors.length} threshold or trend deviation${factors.length === 1 ? '' : 's'} involving ${metricNames.join(', ')}.`,
    triggeredFactors: factors,
    nextSteps,
    limitations: THRESHOLD_LIMITATIONS,
    disclaimer: THRESHOLD_DISCLAIMER,
  };
}

function buildNextSteps(factors: TriggeredFactor[], level: RiskLevel): string[] {
  const steps = new Set<string>();
  const metrics = new Set(factors.map((f) => f.metric));

  if (metrics.has('spo2') || metrics.has('spo2_trend')) {
    steps.add('Verify pulse oximeter finger sensor contact and cabin CO2/O2 environmental telemetry.');
    steps.add('Pause physical exertion, take slow controlled breaths, and re-measure SpO2 in 5–10 minutes.');
  }
  if (metrics.has('heart_rate') || metrics.has('heart_rate_trend')) {
    steps.add('Confirm activity context, rest in a neutral posture, and check hydration intake.');
    steps.add('Repeat heart rate measurement after 10–15 minutes of quiet rest.');
  }
  if (metrics.has('blood_pressure')) {
    steps.add('Verify blood pressure cuff sizing and arm positioning at heart level before re-checking.');
  }
  if (metrics.has('body_temp_c')) {
    steps.add('Verify oral/skin thermistor calibration and monitor ambient module temperature.');
  }
  if (metrics.has('sleep_hours') || metrics.has('sleep_trend')) {
    steps.add('Review circadian lighting alignment and schedule a recovery rest block where mission timeline permits.');
  }

  if (level === 'HIGH') {
    steps.add('Notify crew medical officer / flight surgeon console for review per mission monitoring protocol.');
  } else {
    steps.add('Continue close observation over the next 2–4 telemetry intervals.');
  }

  return Array.from(steps);
}
