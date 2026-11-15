/**
 * Shared TypeScript interfaces for ASTROCARE AI backend modules.
 * Uses erasable types and string literal unions for full compatibility
 * with both tsx and Node.js 22 native type stripping.
 */

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH';

export type ActivityLevel = 'Rest' | 'Light' | 'Moderate' | 'EVA Prep' | 'Exercise';

export type ReadingSource = 'simulated_seed' | 'simulated_live' | 'manual_entry';

export interface AstronautProfile {
  id: number;
  name: string;
  callsign: string;
  role: string;
  mission_name: string;
  habitat_module: string;
  mission_day: number;
  mission_duration_days: number;
  baseline_notes: string;
}

export interface HealthReadingInput {
  heart_rate: number;
  spo2: number;
  systolic_bp: number;
  diastolic_bp: number;
  body_temp_c: number;
  sleep_hours: number;
  activity_level: ActivityLevel;
  source?: ReadingSource;
  recorded_at?: string;
}

export interface HealthReading extends HealthReadingInput {
  id: number;
  recorded_at: string;
  source: ReadingSource;
  risk_level: RiskLevel;
  risk_summary: string;
}

export interface RiskThresholds {
  heart_rate_low_mod: number;
  heart_rate_high_mod: number;
  heart_rate_high_crit: number;
  spo2_mod_min: number;
  spo2_high_min: number;
  systolic_mod_high: number;
  systolic_crit_high: number;
  systolic_mod_low: number;
  diastolic_mod_high: number;
  diastolic_crit_high: number;
  temp_mod_high: number;
  temp_crit_high: number;
  temp_mod_low: number;
  sleep_mod_min: number;
  sleep_high_min: number;
  sleep_drop_mod: number;
  hr_delta_mod: number;
  spo2_drop_mod: number;
  updated_at?: string;
}

export interface TriggeredFactor {
  metric: string;
  label: string;
  observed: string;
  threshold_reference: string;
  severity: RiskLevel;
  explanation: string;
}

export interface RiskAnalysisResult {
  level: RiskLevel;
  title: string;
  summary: string;
  triggeredFactors: TriggeredFactor[];
  nextSteps: string[];
  limitations: string[];
  disclaimer: string;
}

export interface AlertRecord {
  id: number;
  reading_id: number;
  created_at: string;
  severity: RiskLevel;
  title: string;
  triggered_metrics: TriggeredFactor[];
  reason: string;
  guidance: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
}
