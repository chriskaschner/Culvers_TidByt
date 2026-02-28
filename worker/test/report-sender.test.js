import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildReportText, sendWeeklyAnalyticsReport } from '../src/report-sender.js';

// ── D1 mock helpers ──────────────────────────────────────────────────────────

function makeDb(rowMap = {}) {
  return {
    prepare(sql) {
      const key = Object.keys(rowMap).find(k => sql.includes(k));
      const rows = key ? rowMap[key] : [];
      return {
        bind: () => ({ all: async () => ({ results: rows }) }),
        all: async () => ({ results: rows }),
      };
    },
  };
}

function makeEnv(overrides = {}) {
  return {
    DB: makeDb(),
    RESEND_API_KEY: 'test-key',
    REPORT_EMAIL_TO: 'report@example.com',
    ALERT_FROM_EMAIL: 'alerts@custard-calendar.com',
    ...overrides,
  };
}

// ── buildReportText ──────────────────────────────────────────────────────────

describe('buildReportText', () => {
  it('returns a string', async () => {
    const text = await buildReportText(makeDb());
    expect(typeof text).toBe('string');
  });

  it('includes the report header', async () => {
    const text = await buildReportText(makeDb());
    expect(text).toContain('Custard Telemetry Report');
  });

  it('includes Weekly Signals section', async () => {
    const text = await buildReportText(makeDb());
    expect(text).toContain('Weekly Signals');
  });

  it('shows none for alert subscriptions when table empty', async () => {
    const text = await buildReportText(makeDb());
    expect(text).toContain('Alert subscriptions:');
    expect(text).toContain('none');
  });

  it('shows YES when alert_subscribe_success events exist', async () => {
    const db = makeDb({
      "event_type = 'alert_subscribe_success'": [{ 'COUNT(*)': 3 }],
    });
    const text = await buildReportText(db);
    expect(text).toContain('YES -- 3');
  });

  it('shows widget tap slugs when present', async () => {
    const db = makeDb({
      "event_type = 'widget_tap'": [
        { action: 'mt-horeb', count: 5 },
        { action: 'verona', count: 2 },
      ],
    });
    const text = await buildReportText(db);
    expect(text).toContain('Widget Tap Slugs');
    expect(text).toContain('mt-horeb');
  });

  it('shows filter toggle activity when present', async () => {
    const db = makeDb({
      "event_type = 'filter_toggle'": [
        { action: 'chocolate:on', count: 8 },
      ],
    });
    const text = await buildReportText(db);
    expect(text).toContain('Scoop Filter Activity');
    expect(text).toContain('chocolate:on');
  });

  it('shows fallback message when no referrer data', async () => {
    const text = await buildReportText(makeDb());
    expect(text).toContain('no page_view events');
  });

  it('handles DB errors gracefully without throwing', async () => {
    const db = {
      prepare: () => { throw new Error('D1 unavailable'); },
    };
    const text = await buildReportText(db);
    expect(typeof text).toBe('string');
    expect(text).toContain('Custard Telemetry Report');
  });
});

// ── sendWeeklyAnalyticsReport ────────────────────────────────────────────────

describe('sendWeeklyAnalyticsReport', () => {
  let mockSendEmail;

  beforeEach(async () => {
    vi.resetModules();
    mockSendEmail = vi.fn().mockResolvedValue({ ok: true });
    vi.doMock('../src/email-sender.js', () => ({ sendEmail: mockSendEmail }));
  });

  it('skips and returns checked:0 when REPORT_EMAIL_TO not set', async () => {
    const { sendWeeklyAnalyticsReport: fn } = await import('../src/report-sender.js');
    const result = await fn(makeEnv({ REPORT_EMAIL_TO: '' }));
    expect(result.checked).toBe(0);
    expect(result.sent).toBe(0);
  });

  it('returns error when RESEND_API_KEY not set', async () => {
    const { sendWeeklyAnalyticsReport: fn } = await import('../src/report-sender.js');
    const result = await fn(makeEnv({ RESEND_API_KEY: '' }));
    expect(result.sent).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns error when DB not available', async () => {
    const { sendWeeklyAnalyticsReport: fn } = await import('../src/report-sender.js');
    const result = await fn(makeEnv({ DB: null }));
    expect(result.sent).toBe(0);
    expect(result.errors).toContain('DB not available');
  });

  it('calls sendEmail with correct subject format', async () => {
    const { sendWeeklyAnalyticsReport: fn } = await import('../src/report-sender.js');
    await fn(makeEnv());
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const [params] = mockSendEmail.mock.calls[0];
    expect(params.subject).toMatch(/^Custard Calendar Report -- \d{4}-\d{2}-\d{2}$/);
  });

  it('sends to REPORT_EMAIL_TO address', async () => {
    const { sendWeeklyAnalyticsReport: fn } = await import('../src/report-sender.js');
    await fn(makeEnv({ REPORT_EMAIL_TO: 'weekly@test.com' }));
    const [params] = mockSendEmail.mock.calls[0];
    expect(params.to).toBe('weekly@test.com');
  });

  it('returns sent:1 on success', async () => {
    const { sendWeeklyAnalyticsReport: fn } = await import('../src/report-sender.js');
    const result = await fn(makeEnv());
    expect(result.sent).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('returns sent:0 and error when sendEmail fails', async () => {
    mockSendEmail.mockResolvedValue({ ok: false, error: 'invalid from address' });
    const { sendWeeklyAnalyticsReport: fn } = await import('../src/report-sender.js');
    const result = await fn(makeEnv());
    expect(result.sent).toBe(0);
    expect(result.errors[0]).toContain('invalid from address');
  });
});
