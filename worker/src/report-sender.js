/**
 * Weekly analytics report — queries D1 interaction_events and emails a summary.
 *
 * Triggered by the Monday 9am CT cron (0 14 * * 1).
 * Requires REPORT_EMAIL_TO and RESEND_API_KEY in Worker env.
 */

import { sendEmail } from './email-sender.js';

const DEFAULT_DAYS = 7;

/**
 * Run a D1 query and return all rows, or [] on failure.
 */
async function q(db, sql) {
  try {
    const { results } = await db.prepare(sql).all();
    return results || [];
  } catch (_) {
    return [];
  }
}

/**
 * Run a D1 query returning a single integer value (first column of first row).
 */
async function qInt(db, sql) {
  const rows = await q(db, sql);
  if (!rows.length) return 0;
  const val = Object.values(rows[0])[0];
  return typeof val === 'number' ? val : parseInt(val, 10) || 0;
}

function fmtRow(label, value, width = 32) {
  return `  ${(label + ':').padEnd(width)}${value}`;
}

function section(title) {
  return `\n-- ${title} ${'-'.repeat(Math.max(0, 60 - title.length - 4))}`;
}

/**
 * Query D1 and build the weekly report as plain text.
 */
export async function buildReportText(db, days = DEFAULT_DAYS) {
  const since = `datetime('now', '-${days} days')`;

  const [total, ctaClicks, alertSubs, pageViews] = await Promise.all([
    qInt(db, `SELECT COUNT(*) FROM interaction_events WHERE created_at >= ${since}`),
    qInt(db, `SELECT COUNT(*) FROM interaction_events WHERE event_type = 'cta_click' AND created_at >= ${since}`),
    qInt(db, `SELECT COUNT(*) FROM interaction_events WHERE event_type = 'alert_subscribe_success' AND created_at >= ${since}`),
    qInt(db, `SELECT COUNT(*) FROM interaction_events WHERE event_type = 'page_view' AND created_at >= ${since}`),
  ]);

  const [widgetTaps, filterToggles, topReferrers, topStores, byPage] = await Promise.all([
    q(db, `SELECT action, COUNT(*) as count FROM interaction_events WHERE event_type = 'widget_tap' AND created_at >= ${since} GROUP BY action ORDER BY count DESC LIMIT 10`),
    q(db, `SELECT action, COUNT(*) as count FROM interaction_events WHERE event_type = 'filter_toggle' AND created_at >= ${since} GROUP BY action ORDER BY count DESC LIMIT 10`),
    q(db, `SELECT referrer, COUNT(*) as count FROM interaction_events WHERE event_type = 'page_view' AND referrer IS NOT NULL AND referrer != '' AND created_at >= ${since} GROUP BY referrer ORDER BY count DESC LIMIT 10`),
    q(db, `SELECT store_slug, COUNT(*) as count FROM interaction_events WHERE store_slug IS NOT NULL AND created_at >= ${since} GROUP BY store_slug ORDER BY count DESC LIMIT 5`),
    q(db, `SELECT page, COUNT(*) as count FROM interaction_events WHERE created_at >= ${since} GROUP BY page ORDER BY count DESC LIMIT 10`),
  ]);

  const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const lines = [];

  lines.push(`Custard Telemetry Report  |  ${now}`);
  lines.push(`Window: last ${days} days`);

  lines.push(section(`Totals (last ${days}d)`));
  lines.push(fmtRow('Total events', total));
  lines.push(fmtRow('Page views', pageViews));
  lines.push(fmtRow('CTA clicks', ctaClicks));

  lines.push(section('Weekly Signals'));
  lines.push(fmtRow('Alert subscriptions', alertSubs ? `YES -- ${alertSubs}` : 'none'));
  lines.push(fmtRow('Widget taps', widgetTaps.length ? `YES -- ${widgetTaps.length} slug(s)` : 'none'));
  lines.push(fmtRow('Scoop filter toggles', filterToggles.length ? `YES -- ${filterToggles.length} filter(s) used` : 'none'));
  lines.push(fmtRow('Top referrer', topReferrers.length ? (topReferrers[0].referrer || '(direct)') : 'none'));

  if (widgetTaps.length) {
    lines.push(section('Widget Tap Slugs'));
    for (const r of widgetTaps) lines.push(fmtRow(r.action || '(none)', r.count));
  }

  if (filterToggles.length) {
    lines.push(section('Scoop Filter Activity'));
    for (const r of filterToggles) lines.push(fmtRow(r.action || '(none)', r.count));
  }

  if (topReferrers.length) {
    lines.push(section('Top Referrers'));
    for (const r of topReferrers) lines.push(fmtRow(r.referrer || '(direct)', r.count));
  } else {
    lines.push(section('Top Referrers'));
    lines.push('  (no page_view events with referrer data yet)');
  }

  if (byPage.length) {
    lines.push(section('Events by Page'));
    for (const r of byPage) lines.push(fmtRow(r.page || '(none)', r.count));
  }

  if (topStores.length) {
    lines.push(section('Top Stores'));
    for (const r of topStores) lines.push(fmtRow(r.store_slug, r.count));
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Build and email the weekly analytics report.
 * Returns { checked, sent, errors } for cron_runs table compatibility.
 */
export async function sendWeeklyAnalyticsReport(env) {
  const to = env.REPORT_EMAIL_TO;
  if (!to) {
    console.log('sendWeeklyAnalyticsReport: REPORT_EMAIL_TO not set, skipping');
    return { checked: 0, sent: 0, errors: [] };
  }
  if (!env.RESEND_API_KEY) {
    console.error('sendWeeklyAnalyticsReport: RESEND_API_KEY not set');
    return { checked: 1, sent: 0, errors: ['RESEND_API_KEY not set'] };
  }
  if (!env.DB) {
    console.error('sendWeeklyAnalyticsReport: DB not available');
    return { checked: 1, sent: 0, errors: ['DB not available'] };
  }

  const text = await buildReportText(env.DB);
  const date = new Date().toISOString().slice(0, 10);
  const fromAddress = env.ALERT_FROM_EMAIL || 'alerts@custard-calendar.com';

  const result = await sendEmail(
    {
      to,
      subject: `Custard Calendar Report -- ${date}`,
      html: `<pre style="font-family:monospace;font-size:13px;line-height:1.6;">${text}</pre>`,
    },
    env.RESEND_API_KEY,
    fromAddress,
  );

  if (!result.ok) {
    console.error(`sendWeeklyAnalyticsReport: email failed -- ${result.error}`);
    return { checked: 1, sent: 0, errors: [result.error] };
  }

  console.log(`sendWeeklyAnalyticsReport: sent to ${to}`);
  return { checked: 1, sent: 1, errors: [] };
}
