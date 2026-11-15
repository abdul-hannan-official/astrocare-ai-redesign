import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { generateAssistantReply } from './assistant.ts';
import {
  acknowledgeAlert,
  generateSimulatedTick,
  getAlerts,
  getAnalytics,
  getAssistantMessages,
  getCurrentReadingWithAnalysis,
  getHistory,
  getThresholds,
  initDatabase,
  insertReadingAndEvaluate,
  resetThresholds,
  saveAssistantMessage,
  saveThresholds,
} from './db.ts';
import {
  THRESHOLD_DISCLAIMER,
  validateReadingInput,
  validateThresholdUpdates,
} from './riskEngine.ts';

/**
 * Creates and configures the ASTROCARE AI Express API application.
 * Separated from Vite/static mounting so automated tests can exercise
 * all HTTP endpoints directly against SQLite persistence.
 */
export function createApiApp(): express.Express {
  initDatabase();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Handle malformed JSON request bodies cleanly with structured 400 JSON
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (
      err &&
      typeof err === 'object' &&
      'type' in err &&
      (err as { type?: string }).type === 'entity.parse.failed'
    ) {
      res.status(400).json({
        error: 'Invalid JSON payload.',
        details: ['Request body could not be parsed as valid JSON.'],
      });
      return;
    }
    next(err);
  });

  // ---------------------------------------------------------------------------
  // ASTROCARE AI REST API ENDPOINTS
  // ---------------------------------------------------------------------------

  // GET /api/health/current - Latest reading, astronaut profile, risk analysis, active alert count
  app.get('/api/health/current', (_req, res) => {
    try {
      const payload = getCurrentReadingWithAnalysis();
      res.json({
        ...payload,
        disclaimer: THRESHOLD_DISCLAIMER,
      });
    } catch (error) {
      console.error('GET /api/health/current failed:', error);
      res.status(500).json({ error: 'Failed to retrieve current health telemetry.' });
    }
  });

  // GET /api/health/history - Historical health readings with validated ?limit= and ?hours=
  app.get('/api/health/history', (req, res) => {
    try {
      let limit = 40;
      if (req.query.limit !== undefined) {
        const parsedLimit = Number(req.query.limit);
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
          res.status(400).json({
            error: 'Invalid limit query parameter.',
            details: ['limit must be an integer between 1 and 200.'],
          });
          return;
        }
        limit = parsedLimit;
      }

      let hours: number | undefined;
      if (req.query.hours !== undefined) {
        const parsedHours = Number(req.query.hours);
        if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 720) {
          res.status(400).json({
            error: 'Invalid hours query parameter.',
            details: ['hours must be a positive number up to 720.'],
          });
          return;
        }
        hours = parsedHours;
      }

      const readings = getHistory(limit, hours);
      res.json({ readings, count: readings.length });
    } catch (error) {
      console.error('GET /api/health/history failed:', error);
      res.status(500).json({ error: 'Failed to retrieve historical telemetry.' });
    }
  });

  // POST /api/health/readings - Validate, persist, and evaluate manual or external vital reading
  app.post('/api/health/readings', (req, res) => {
    try {
      const validation = validateReadingInput(req.body);
      if (!validation.valid || !validation.data) {
        res.status(400).json({
          error: 'Validation failed for health reading.',
          details: validation.errors,
        });
        return;
      }

      const result = insertReadingAndEvaluate(validation.data);
      res.status(201).json(result);
    } catch (error) {
      console.error('POST /api/health/readings failed:', error);
      res.status(500).json({ error: 'Failed to save health reading.' });
    }
  });

  // POST /api/health/simulate - Generate and persist one simulated telemetry tick
  app.post('/api/health/simulate', (_req, res) => {
    try {
      const result = generateSimulatedTick();
      res.status(201).json(result);
    } catch (error) {
      console.error('POST /api/health/simulate failed:', error);
      res.status(500).json({ error: 'Failed to generate simulated reading.' });
    }
  });

  // GET /api/alerts - Retrieve categorized monitoring alerts with validated ?severity= and ?status=
  app.get('/api/alerts', (req, res) => {
    try {
      let severity: string | undefined;
      if (req.query.severity !== undefined && req.query.severity !== '') {
        const rawSev = String(req.query.severity).toUpperCase();
        if (!['LOW', 'MODERATE', 'HIGH'].includes(rawSev)) {
          res.status(400).json({
            error: 'Invalid severity filter.',
            details: ['severity must be one of: LOW, MODERATE, HIGH.'],
          });
          return;
        }
        severity = rawSev;
      }

      let status: string | undefined;
      if (req.query.status !== undefined && req.query.status !== '') {
        const rawStatus = String(req.query.status).toLowerCase();
        if (!['unacknowledged', 'acknowledged'].includes(rawStatus)) {
          res.status(400).json({
            error: 'Invalid status filter.',
            details: ['status must be unacknowledged or acknowledged.'],
          });
          return;
        }
        status = rawStatus;
      }

      const alerts = getAlerts(severity, status);
      res.json({ alerts, count: alerts.length });
    } catch (error) {
      console.error('GET /api/alerts failed:', error);
      res.status(500).json({ error: 'Failed to retrieve alerts.' });
    }
  });

  // POST /api/alerts/:id/acknowledge - Acknowledge an alert and persist timestamp
  app.post('/api/alerts/:id/acknowledge', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid alert ID.' });
        return;
      }
      const updated = acknowledgeAlert(id);
      if (!updated) {
        res.status(404).json({ error: 'Alert not found.' });
        return;
      }
      res.json({ alert: updated });
    } catch (error) {
      console.error('POST /api/alerts/:id/acknowledge failed:', error);
      res.status(500).json({ error: 'Failed to acknowledge alert.' });
    }
  });

  // GET /api/thresholds, PUT /api/thresholds, POST /api/thresholds/reset
  app.get('/api/thresholds', (_req, res) => {
    try {
      res.json({
        thresholds: getThresholds(),
        disclaimer: THRESHOLD_DISCLAIMER,
      });
    } catch (error) {
      console.error('GET /api/thresholds failed:', error);
      res.status(500).json({ error: 'Failed to retrieve threshold configuration.' });
    }
  });

  app.put('/api/thresholds', (req, res) => {
    try {
      const current = getThresholds();
      const check = validateThresholdUpdates(req.body, current);
      if (!check.valid || !check.thresholds) {
        res.status(400).json({
          error: 'Invalid threshold configuration.',
          details: check.errors,
        });
        return;
      }
      const saved = saveThresholds(check.thresholds);
      res.json({ thresholds: saved, disclaimer: THRESHOLD_DISCLAIMER });
    } catch (error) {
      console.error('PUT /api/thresholds failed:', error);
      res.status(500).json({ error: 'Failed to save thresholds.' });
    }
  });

  app.post('/api/thresholds/reset', (_req, res) => {
    try {
      const saved = resetThresholds();
      res.json({ thresholds: saved, disclaimer: THRESHOLD_DISCLAIMER });
    } catch (error) {
      console.error('POST /api/thresholds/reset failed:', error);
      res.status(500).json({ error: 'Failed to reset thresholds.' });
    }
  });

  // GET /api/analytics - 24h trends, 7-day summaries, sleep analytics, alert history
  app.get('/api/analytics', (_req, res) => {
    try {
      const analytics = getAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error('GET /api/analytics failed:', error);
      res.status(500).json({ error: 'Failed to compute health analytics.' });
    }
  });

  // GET /api/analytics/export.csv - Downloadable CSV telemetry report
  app.get('/api/analytics/export.csv', (_req, res) => {
    try {
      const rows = getHistory(200).slice().reverse();
      const header = [
        'id',
        'recorded_at',
        'heart_rate_bpm',
        'spo2_pct',
        'systolic_bp_mmhg',
        'diastolic_bp_mmhg',
        'body_temp_c',
        'sleep_hours',
        'activity_level',
        'source',
        'risk_level',
        'risk_summary',
      ].join(',');

      const escapeCsv = (val: unknown) => {
        const str = String(val ?? '');
        if (/[",\n]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const lines = rows.map((r) =>
        [
          r.id,
          r.recorded_at,
          r.heart_rate,
          r.spo2,
          r.systolic_bp,
          r.diastolic_bp,
          r.body_temp_c,
          r.sleep_hours,
          r.activity_level,
          r.source,
          r.risk_level,
          r.risk_summary,
        ]
          .map(escapeCsv)
          .join(','),
      );

      const csv = [header, ...lines].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="astrocare-alex-morgan-telemetry.csv"',
      );
      res.send(csv);
    } catch (error) {
      console.error('GET /api/analytics/export.csv failed:', error);
      res.status(500).json({ error: 'Failed to export CSV report.' });
    }
  });

  // GET /api/assistant/history & POST /api/assistant/chat
  app.get('/api/assistant/history', (_req, res) => {
    try {
      const messages = getAssistantMessages();
      res.json({ messages });
    } catch (error) {
      console.error('GET /api/assistant/history failed:', error);
      res.status(500).json({ error: 'Failed to load assistant chat history.' });
    }
  });

  app.post('/api/assistant/chat', async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        res.status(400).json({ error: 'Please send your question in a valid JSON request.' });
        return;
      }

      const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
      if (!message || message.length > 600) {
        res.status(400).json({
          error: 'Please enter a question between 1 and 600 characters before sending.',
        });
        return;
      }

      const result = await generateAssistantReply(message);
      saveAssistantMessage('user', message, result.contextSummary);
      saveAssistantMessage('assistant', result.reply, result.contextSummary);

      res.json({
        reply: result.reply,
        mode: result.mode,
        contextSummary: result.contextSummary,
      });
    } catch (error) {
      console.error('POST /api/assistant/chat failed:', error);
      res.status(500).json({
        error: 'The ASTROCARE Assistant ran into a temporary issue reading your health history. Please try again in a moment.',
      });
    }
  });

  // Structured 404 JSON for unknown /api/* endpoints
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Catch-all error handler for unexpected API failures
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      console.error('Unhandled API error:', err);
      res.status(500).json({ error: 'Internal server error.' });
      return;
    }
    next(err);
  });

  return app;
}
