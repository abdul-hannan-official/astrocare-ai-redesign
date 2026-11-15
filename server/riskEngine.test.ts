import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeReading,
  DEFAULT_THRESHOLDS,
  THRESHOLD_LIMITATIONS,
  validateReadingInput,
  validateThresholdUpdates,
} from './riskEngine.ts';
import type { HealthReading } from './types.ts';

const baselineHistory: HealthReading[] = [
  {
    id: 1,
    recorded_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    heart_rate: 68,
    spo2: 98.4,
    systolic_bp: 116,
    diastolic_bp: 74,
    body_temp_c: 36.7,
    sleep_hours: 7.8,
    activity_level: 'Rest',
    source: 'simulated_seed',
    risk_level: 'LOW',
    risk_summary: 'Nominal',
  },
  {
    id: 2,
    recorded_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    heart_rate: 70,
    spo2: 98.2,
    systolic_bp: 118,
    diastolic_bp: 75,
    body_temp_c: 36.8,
    sleep_hours: 7.8,
    activity_level: 'Light',
    source: 'simulated_seed',
    risk_level: 'LOW',
    risk_summary: 'Nominal',
  },
];

test('validateReadingInput accepts valid vitals and rejects out-of-range/empty inputs', () => {
  const valid = validateReadingInput({
    heart_rate: 72,
    spo2: 98,
    systolic_bp: 118,
    diastolic_bp: 76,
    body_temp_c: 36.8,
    sleep_hours: 7.4,
    activity_level: 'Rest',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.data?.heart_rate, 72);

  const invalid = validateReadingInput({
    heart_rate: 310,
    spo2: 50,
    systolic_bp: 80,
    diastolic_bp: 90,
    body_temp_c: 36.8,
    sleep_hours: '',
    activity_level: 'Invalid',
    recorded_at: 'not-a-date',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 6);

  const nonObject = validateReadingInput([]);
  assert.equal(nonObject.valid, false);
});

test('Scenario 1 (Normal / LOW): nominal vitals produce LOW monitoring status and include limitations', () => {
  const result = analyzeReading(
    {
      heart_rate: 70,
      spo2: 98.2,
      systolic_bp: 116,
      diastolic_bp: 74,
      body_temp_c: 36.7,
      sleep_hours: 7.5,
      activity_level: 'Light',
    },
    baselineHistory,
    DEFAULT_THRESHOLDS,
  );
  assert.equal(result.level, 'LOW');
  assert.equal(result.triggeredFactors.length, 0);
  assert.ok(result.limitations.length >= 3);
  assert.match(result.disclaimer, /not a clinically validated medical device/i);
});

test('Scenario 2 (Moderate): detects Heart Rate, Blood Pressure, and Temperature moderate anomalies', () => {
  const result = analyzeReading(
    {
      heart_rate: 104,
      spo2: 97.6,
      systolic_bp: 138,
      diastolic_bp: 84,
      body_temp_c: 37.6,
      sleep_hours: 7.2,
      activity_level: 'Rest',
    },
    baselineHistory,
    DEFAULT_THRESHOLDS,
  );
  assert.equal(result.level, 'MODERATE');
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'heart_rate' && f.severity === 'MODERATE'));
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'blood_pressure' && f.severity === 'MODERATE'));
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'body_temp_c' && f.severity === 'MODERATE'));

  // Every triggered factor must show indicator, measured value, configured threshold, and reason
  for (const factor of result.triggeredFactors) {
    assert.ok(factor.label.length > 0);
    assert.ok(factor.observed.length > 0);
    assert.ok(factor.threshold_reference.length > 0);
    assert.ok(factor.explanation.length > 0);
  }
});

test('Scenario 3 (Moderate): detects SpO2 dip and Sleep pattern change relative to rolling baseline', () => {
  const result = analyzeReading(
    {
      heart_rate: 74,
      spo2: 93.8,
      systolic_bp: 120,
      diastolic_bp: 76,
      body_temp_c: 36.8,
      sleep_hours: 6.1, // Above 6.0 absolute floor, but -1.7 hrs drop vs 7.8 hr avg!
      activity_level: 'Rest',
    },
    baselineHistory,
    DEFAULT_THRESHOLDS,
  );
  assert.equal(result.level, 'MODERATE');
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'spo2'));
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'spo2_trend'));
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'sleep_trend'));
});

test('Scenario 4 (Moderate): detects low heart rate, low systolic BP, and low body temperature anomalies', () => {
  const result = analyzeReading(
    {
      heart_rate: 45,
      spo2: 98.0,
      systolic_bp: 88,
      diastolic_bp: 58,
      body_temp_c: 35.6,
      sleep_hours: 7.4,
      activity_level: 'Rest',
    },
    [],
    DEFAULT_THRESHOLDS,
  );
  assert.equal(result.level, 'MODERATE');
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'heart_rate'));
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'blood_pressure'));
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'body_temp_c'));
});

test('Scenario 5 (High Alert): detects HIGH monitoring anomalies across SpO2, HR, BP, Temp, and Sleep without diagnosing disease', () => {
  const result = analyzeReading(
    {
      heart_rate: 122,
      spo2: 90.0,
      systolic_bp: 154,
      diastolic_bp: 97,
      body_temp_c: 38.4,
      sleep_hours: 4.2,
      activity_level: 'Rest',
    },
    baselineHistory,
    DEFAULT_THRESHOLDS,
  );
  assert.equal(result.level, 'HIGH');
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'spo2' && f.severity === 'HIGH'));
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'heart_rate' && f.severity === 'HIGH'));
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'blood_pressure' && f.severity === 'HIGH'));
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'body_temp_c' && f.severity === 'HIGH'));
  assert.ok(result.triggeredFactors.some((f) => f.metric === 'sleep_hours' && f.severity === 'HIGH'));
  assert.ok(result.nextSteps.some((s) => /flight surgeon|medical officer/i.test(s)));
  assert.equal(/diagnos/i.test(result.summary), false);
});

test('Context-aware exertion rule adjusts HR threshold during Exercise without false resting alert', () => {
  const result = analyzeReading(
    {
      heart_rate: 122,
      spo2: 97.5,
      systolic_bp: 130,
      diastolic_bp: 80,
      body_temp_c: 37.1,
      sleep_hours: 7.2,
      activity_level: 'Exercise',
    },
    baselineHistory,
    DEFAULT_THRESHOLDS,
  );
  assert.equal(result.level, 'LOW');
  assert.equal(result.triggeredFactors.length, 0);
});

test('validateThresholdUpdates enforces logical ordering and bounds', () => {
  const bad = validateThresholdUpdates(
    { spo2_high_min: 96, spo2_mod_min: 94 },
    DEFAULT_THRESHOLDS,
  );
  assert.equal(bad.valid, false);

  const outOfRange = validateThresholdUpdates({ sleep_drop_mod: 12 }, DEFAULT_THRESHOLDS);
  assert.equal(outOfRange.valid, false);

  const good = validateThresholdUpdates(
    { spo2_high_min: 90, spo2_mod_min: 93, sleep_drop_mod: 2.0 },
    DEFAULT_THRESHOLDS,
  );
  assert.equal(good.valid, true);
  assert.equal(good.thresholds?.spo2_high_min, 90);
  assert.equal(good.thresholds?.sleep_drop_mod, 2.0);
  assert.ok(THRESHOLD_LIMITATIONS.length >= 3);
});
