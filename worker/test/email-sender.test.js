import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendAlertEmail, sendWeeklyDigestEmail } from '../src/email-sender.js';

// Capture what gets sent to the Resend API without making real HTTP calls
let capturedBody = null;
vi.stubGlobal('fetch', vi.fn(async (url, options) => {
  capturedBody = JSON.parse(options.body);
  return { ok: true, text: async () => '' };
}));

const API_KEY = 'test-key';
const FROM = 'alerts@test.com';

const BASE_ALERT_PARAMS = {
  email: 'user@example.com',
  storeName: 'Mt. Horeb',
  storeAddress: '123 Main St',
  statusUrl: 'https://example.com/status?token=abc',
  unsubscribeUrl: 'https://example.com/unsub?token=abc',
};

const MATCH = { title: 'Turtle', date: '2026-02-20', description: 'Rich custard.' };

describe('sendAlertEmail — signal block', () => {
  beforeEach(() => { capturedBody = null; });

  it('omits signal block when signal is null', async () => {
    await sendAlertEmail({ ...BASE_ALERT_PARAMS, matches: [MATCH], signal: null }, API_KEY, FROM);
    expect(capturedBody.html).not.toContain('Flavor Signal');
  });

  it('omits signal block when signal is absent', async () => {
    await sendAlertEmail({ ...BASE_ALERT_PARAMS, matches: [MATCH] }, API_KEY, FROM);
    expect(capturedBody.html).not.toContain('Flavor Signal');
  });

  it('injects signal block with headline and explanation when signal is present', async () => {
    const signal = {
      headline: 'Turtle is overdue',
      explanation: 'Turtle usually appears every 10 days but has not been seen in 20 days.',
    };
    await sendAlertEmail({ ...BASE_ALERT_PARAMS, matches: [MATCH], signal }, API_KEY, FROM);
    expect(capturedBody.html).toContain('Flavor Signal');
    expect(capturedBody.html).toContain('Turtle is overdue');
    expect(capturedBody.html).toContain('Turtle usually appears every 10 days');
  });

  it('escapes HTML in signal headline and explanation', async () => {
    const signal = {
      headline: '<script>alert(1)</script>',
      explanation: 'Safe & sound.',
    };
    await sendAlertEmail({ ...BASE_ALERT_PARAMS, matches: [MATCH], signal }, API_KEY, FROM);
    expect(capturedBody.html).not.toContain('<script>');
    expect(capturedBody.html).toContain('&lt;script&gt;');
    expect(capturedBody.html).toContain('Safe &amp; sound.');
  });
});

const BASE_DIGEST_PARAMS = {
  email: 'user@example.com',
  storeName: 'Mt. Horeb',
  storeAddress: '123 Main St',
  matches: [MATCH],
  allFlavors: [{ title: 'Turtle', date: '2026-02-20' }],
  statusUrl: 'https://example.com/status?token=abc',
  unsubscribeUrl: 'https://example.com/unsub?token=abc',
  narrative: null,
  forecast: null,
};

describe('sendWeeklyDigestEmail — signals block', () => {
  beforeEach(() => { capturedBody = null; });

  it('omits signals block when signals is empty', async () => {
    await sendWeeklyDigestEmail({ ...BASE_DIGEST_PARAMS, signals: [] }, API_KEY, FROM);
    expect(capturedBody.html).not.toContain("This Week's Signals");
  });

  it('omits signals block when signals is absent', async () => {
    await sendWeeklyDigestEmail({ ...BASE_DIGEST_PARAMS }, API_KEY, FROM);
    expect(capturedBody.html).not.toContain("This Week's Signals");
  });

  it('injects signals block with both signal entries when signals are present', async () => {
    const signals = [
      { headline: 'Turtle is overdue', explanation: 'Turtle usually appears every 10 days.' },
      { headline: 'Turtle peaks on Tuesdays', explanation: 'Strong Tuesday scheduling bias.' },
    ];
    await sendWeeklyDigestEmail({ ...BASE_DIGEST_PARAMS, signals }, API_KEY, FROM);
    expect(capturedBody.html).toContain("This Week's Signals");
    expect(capturedBody.html).toContain('Turtle is overdue');
    expect(capturedBody.html).toContain('Turtle peaks on Tuesdays');
    expect(capturedBody.html).toContain('Strong Tuesday scheduling bias.');
  });

  it('renders single signal without error', async () => {
    const signals = [{ headline: 'Mint Explosion peaks in December', explanation: '75% of appearances in Dec-Feb.' }];
    await sendWeeklyDigestEmail({ ...BASE_DIGEST_PARAMS, signals }, API_KEY, FROM);
    expect(capturedBody.html).toContain("This Week's Signals");
    expect(capturedBody.html).toContain('Mint Explosion peaks in December');
  });
});
