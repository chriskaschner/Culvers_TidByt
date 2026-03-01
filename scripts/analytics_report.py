#!/usr/bin/env python3
"""Pull live telemetry from the Worker API and print a measurement report.

Queries:
  GET /api/v1/events/summary?days=N          — interaction events (CTA clicks, popups, signals)
  GET /api/v1/quiz/personality-index?days=N  — quiz completion + archetype distribution

Requires WORKER_API_TOKEN environment variable (or --token flag).
When --email is used, also requires RESEND_API_KEY (or --resend-key).

Usage:
  uv run python scripts/analytics_report.py
  uv run python scripts/analytics_report.py --days 30
  uv run python scripts/analytics_report.py --weekly
  uv run python scripts/analytics_report.py --baseline  # write to WORKLOG.md
  uv run python scripts/analytics_report.py --email me@example.com
  uv run python scripts/analytics_report.py --token <token>
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import sys
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

WORKER_BASE = "https://custard.chriskaschner.com"
WORKLOG_PATH = Path(__file__).resolve().parent.parent / "WORKLOG.md"
REPORT_FROM_EMAIL = os.environ.get("ALERT_FROM_EMAIL", "alerts@custard-calendar.com")
REPORT_USER_AGENT = os.environ.get("ANALYTICS_REPORT_USER_AGENT", "custard-analytics-report/1.0")


def fetch_json(url: str, token: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": REPORT_USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} from {url}: {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error fetching {url}: {exc.reason}") from exc


def pct(count: int, total: int) -> str:
    if not total:
        return "n/a"
    return f"{100 * count / total:.1f}%"


def fmt_row(label: str, value: str | int, width: int = 32) -> str:
    label_s = f"{label}:".ljust(width)
    return f"  {label_s}{value}"


def print_section(title: str) -> None:
    print()
    print(f"-- {title} " + "-" * max(0, 60 - len(title) - 4))


def domain_from_referrer(referrer: str | None) -> str:
    if not referrer:
        return "(direct)"
    text = str(referrer).strip()
    if not text:
        return "(direct)"
    try:
        parsed = urllib.parse.urlparse(text)
        if parsed.netloc:
            return parsed.netloc.lower()
    except Exception:
        pass
    return text.lower()


def referrer_bucket(referrer: str | None) -> str:
    domain = domain_from_referrer(referrer)
    if domain == "(direct)":
        return "direct"
    if any(engine in domain for engine in ("google.", "bing.", "duckduckgo.", "yahoo.")):
        return "search"
    if any(social in domain for social in ("facebook.", "instagram.", "x.com", "twitter.", "reddit.", "t.co")):
        return "social"
    if "scriptable" in domain or "widget" in domain:
        return "widget"
    return domain


def count_event_type(events_data: dict, event_type: str) -> int:
    by_type = events_data.get("by_type", []) or []
    for row in by_type:
        if (row.get("event_type") or "") == event_type:
            return int(row.get("count", 0) or 0)
    return 0


def bucket_referrers(top_referrers: list[dict]) -> list[tuple[str, int]]:
    buckets: dict[str, int] = {}
    for row in top_referrers or []:
        bucket = referrer_bucket(row.get("referrer"))
        count = int(row.get("count", 0) or 0)
        buckets[bucket] = buckets.get(bucket, 0) + count
    return sorted(buckets.items(), key=lambda kv: kv[1], reverse=True)


def report_events(data: dict) -> None:
    t = data.get("totals", {})
    days = data.get("window_days", "?")
    total = t.get("events", 0)

    print_section(f"Interaction Events (last {days}d)")
    print(fmt_row("Total events", total))
    print(fmt_row("CTA clicks", f"{t.get('cta_clicks', 0):,}  ({pct(t.get('cta_clicks', 0), total)})"))
    print(fmt_row("Popup opens", f"{t.get('popup_opens', 0):,}  ({pct(t.get('popup_opens', 0), total)})"))
    print(fmt_row("Signal views", f"{t.get('signal_views', 0):,}  ({pct(t.get('signal_views', 0), total)})"))
    print(fmt_row("Quiz completions", f"{t.get('quiz_completions', 0):,}  ({pct(t.get('quiz_completions', 0), total)})"))
    print(fmt_row("Onboarding views", f"{t.get('onboarding_views', 0):,}"))
    print(fmt_row("Onboarding clicks", f"{t.get('onboarding_clicks', 0):,}"))

    by_action = data.get("by_action", [])
    if by_action:
        print_section("Top Actions")
        for row in by_action[:10]:
            print(fmt_row(row.get("action") or "(none)", row.get("count", 0)))

    by_page = data.get("by_page", [])
    if by_page:
        print_section("Events by Page")
        for row in by_page[:10]:
            print(fmt_row(row.get("page") or "(none)", row.get("count", 0)))

    top_stores = data.get("top_stores", [])
    if top_stores:
        print_section("Top Stores by Interaction")
        for row in top_stores[:10]:
            print(fmt_row(row.get("store_slug") or "(none)", row.get("count", 0)))

    top_flavors = data.get("top_flavors", [])
    if top_flavors:
        print_section("Top Flavors by Interaction")
        for row in top_flavors[:10]:
            print(fmt_row(row.get("flavor") or "(none)", row.get("count", 0)))

    by_device_type = data.get("by_device_type", [])
    if by_device_type:
        print_section("By Device Type")
        for row in by_device_type[:10]:
            print(fmt_row(row.get("device_type") or "unknown", row.get("count", 0)))

    top_referrers = data.get("top_referrers", [])
    if top_referrers:
        print_section("Top Referrers")
        for row in top_referrers[:10]:
            domain = domain_from_referrer(row.get("referrer"))
            print(fmt_row(domain, row.get("count", 0)))


def report_quiz(data: dict) -> None:
    days = data.get("window_days", "?")
    totals = data.get("totals", {})
    completions = totals.get("completions", 0)
    matched = totals.get("matched_in_radius", 0)
    outside = totals.get("matched_outside_radius", 0)
    no_match = totals.get("no_match", 0)
    trivia_correct = totals.get("trivia_correct", 0)
    trivia_total = totals.get("trivia_total", 0)

    print_section(f"Quiz Results (last {days}d)")
    print(fmt_row("Total completions", completions))
    print(fmt_row("Matched in radius", f"{matched:,}  ({pct(matched, completions)})"))
    print(fmt_row("Matched outside radius", f"{outside:,}  ({pct(outside, completions)})"))
    print(fmt_row("No match", f"{no_match:,}  ({pct(no_match, completions)})"))
    if trivia_total:
        print(fmt_row("Trivia accuracy", f"{trivia_correct}/{trivia_total}  ({pct(trivia_correct, trivia_total)})"))

    top_archetypes = data.get("top_archetypes", [])
    if top_archetypes:
        print_section("Top Quiz Archetypes")
        for row in top_archetypes[:10]:
            print(fmt_row(row.get("archetype") or "(none)", row.get("count", 0)))

    top_quizzes = data.get("top_quizzes", [])
    if top_quizzes:
        print_section("Quiz Modes Played")
        for row in top_quizzes[:10]:
            print(fmt_row(row.get("quiz_id") or "(none)", row.get("count", 0)))


def report_weekly(events_data: dict, widget_data: dict, scoop_filter_data: dict, days: int) -> None:
    print_section(f"Weekly Signal Digest (last {days}d)")

    alert_success = count_event_type(events_data, "alert_subscribe_success")
    print(fmt_row("Alerts subscribed", f"{'YES' if alert_success > 0 else 'NO'} ({alert_success:,})"))

    widget_taps = int((widget_data.get("totals") or {}).get("events", 0) or 0)
    print(fmt_row("Widget taps", f"{'YES' if widget_taps > 0 else 'NO'} ({widget_taps:,})"))

    scoop_filters = int((scoop_filter_data.get("totals") or {}).get("events", 0) or 0)
    print(fmt_row("Scoop filters", f"{'YES' if scoop_filters > 0 else 'NO'} ({scoop_filters:,})"))

    buckets = bucket_referrers(events_data.get("top_referrers", []))
    top_bucket = buckets[0][0] if buckets else "none"
    print(fmt_row("Top referrer bucket", top_bucket))

    top_widget_stores = widget_data.get("top_stores", []) or []
    if top_widget_stores:
        print_section("Widget Taps by Store Slug")
        for row in top_widget_stores[:10]:
            print(fmt_row(row.get("store_slug") or "(none)", row.get("count", 0)))
    else:
        print_section("Widget Taps by Store Slug")
        print("  (no widget_tap events in window)")

    scoop_actions = scoop_filter_data.get("by_action", []) or []
    if scoop_actions:
        print_section("Scoop Filter Activity")
        for row in scoop_actions[:10]:
            print(fmt_row(row.get("action") or "(none)", row.get("count", 0)))
    else:
        print_section("Scoop Filter Activity")
        print("  (no scoop filter activity in window)")

    if buckets:
        print_section("Referrer Buckets")
        for bucket, count in buckets[:10]:
            print(fmt_row(bucket, count))
    else:
        print_section("Referrer Buckets")
        print("  (no page_view referrer data yet)")


def build_report_text(
    events_data: dict,
    quiz_data: dict,
    days: int,
    *,
    weekly: bool = False,
    widget_data: dict | None = None,
    scoop_filter_data: dict | None = None,
) -> str:
    """Capture the full report as a string (same output as printing to stdout)."""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        if weekly:
            print(f"Custard Weekly Digest  |  {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
            print(f"Window: last {days} days  |  Source: {WORKER_BASE}")
            report_weekly(events_data or {}, widget_data or {}, scoop_filter_data or {}, days)
        else:
            print(f"Custard Telemetry Report  |  {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
            print(f"Window: last {days} days  |  Source: {WORKER_BASE}")
            if events_data:
                report_events(events_data)
            if quiz_data:
                report_quiz(quiz_data)
        print()
    return buf.getvalue()


def send_report_email(body: str, to: str, resend_key: str) -> None:
    """Send the report text as a plain-text email via Resend."""
    subject = f"Custard Calendar Report — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    payload = json.dumps({
        "from": REPORT_FROM_EMAIL,
        "to": [to],
        "subject": subject,
        "text": body,
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {resend_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
        print(f"Report emailed to {to}  (id={result.get('id')})")
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Resend HTTP {exc.code}: {err_body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error sending email: {exc.reason}") from exc


def write_baseline(events_data: dict, quiz_data: dict, days: int) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    t = events_data.get("totals", {})
    qt = quiz_data.get("totals", {})
    total_events = t.get("events", 0)
    completions = qt.get("completions", 0)
    matched = qt.get("matched_in_radius", 0)

    baseline_block = f"""
## Measurement Baseline: {now} (last {days}d)

| Metric | Value |
|---|---|
| Total interaction events | {total_events:,} |
| CTA clicks | {t.get('cta_clicks', 0):,} ({pct(t.get('cta_clicks', 0), total_events)}) |
| Popup opens | {t.get('popup_opens', 0):,} ({pct(t.get('popup_opens', 0), total_events)}) |
| Signal views | {t.get('signal_views', 0):,} ({pct(t.get('signal_views', 0), total_events)}) |
| Quiz completions | {completions:,} |
| Quiz match rate (in-radius) | {pct(matched, completions)} |
| Onboarding views | {t.get('onboarding_views', 0):,} |

_Generated by `scripts/analytics_report.py --baseline`_
"""

    existing = WORKLOG_PATH.read_text(encoding="utf-8") if WORKLOG_PATH.exists() else ""
    with WORKLOG_PATH.open("w", encoding="utf-8") as f:
        f.write(existing.rstrip() + "\n" + baseline_block)

    print(f"\nBaseline written to {WORKLOG_PATH.name}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Custard telemetry measurement report")
    parser.add_argument("--days", type=int, default=7, help="Lookback window in days (default: 7)")
    parser.add_argument("--token", default=os.environ.get("WORKER_API_TOKEN"), help="API bearer token")
    parser.add_argument("--baseline", action="store_true", help="Append baseline snapshot to WORKLOG.md")
    parser.add_argument("--weekly", action="store_true", help="Print weekly digest signals")
    parser.add_argument("--email", default=None, metavar="ADDRESS", help="Email address to send report to")
    parser.add_argument("--resend-key", default=os.environ.get("RESEND_API_KEY"), help="Resend API key (or RESEND_API_KEY env var)")
    args = parser.parse_args()

    if not args.token:
        print("Error: WORKER_API_TOKEN env var or --token required.", file=sys.stderr)
        sys.exit(1)

    if args.email and not args.resend_key:
        print("Error: RESEND_API_KEY env var or --resend-key required when using --email.", file=sys.stderr)
        sys.exit(1)

    events_url = f"{WORKER_BASE}/api/v1/events/summary?days={args.days}"
    quiz_url = f"{WORKER_BASE}/api/v1/quiz/personality-index?days={args.days}"
    widget_url = f"{WORKER_BASE}/api/v1/events/summary?days={args.days}&event_type=widget_tap"
    scoop_filter_url = f"{WORKER_BASE}/api/v1/events/summary?days={args.days}&event_type=filter_toggle&page=scoop"

    if args.weekly:
        print(f"Custard Weekly Digest  |  {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    else:
        print(f"Custard Telemetry Report  |  {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"Window: last {args.days} days  |  Source: {WORKER_BASE}")

    events_data: dict = {}
    quiz_data: dict = {}
    widget_data: dict = {}
    scoop_filter_data: dict = {}

    try:
        events_data = fetch_json(events_url, args.token)
        if args.weekly:
            widget_data = fetch_json(widget_url, args.token)
            scoop_filter_data = fetch_json(scoop_filter_url, args.token)
            report_weekly(events_data, widget_data, scoop_filter_data, args.days)
        else:
            report_events(events_data)
    except RuntimeError as exc:
        print(f"\nWarning: could not fetch events summary: {exc}", file=sys.stderr)

    if not args.weekly:
        try:
            quiz_data = fetch_json(quiz_url, args.token)
            report_quiz(quiz_data)
        except RuntimeError as exc:
            print(f"\nWarning: could not fetch quiz personality index: {exc}", file=sys.stderr)

    if args.baseline:
        write_baseline(events_data, quiz_data, args.days)

    if args.email:
        text = build_report_text(
            events_data,
            quiz_data,
            args.days,
            weekly=args.weekly,
            widget_data=widget_data,
            scoop_filter_data=scoop_filter_data,
        )
        send_report_email(text, args.email, args.resend_key)

    print()


if __name__ == "__main__":
    main()
