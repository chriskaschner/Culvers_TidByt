---
created: 2026-03-09T15:52:02.136Z
title: Alert on failed flavors and stores
area: api
files: []
---

## Problem

Hefners (and potentially other stores) can become unavailable, returning failed responses for flavor/store lookups. Currently there is no alerting or monitoring when this happens, so failures go unnoticed until a user reports it.

## Solution

Add alarm/alert mechanism for failed flavor and store API responses. Could include:
- Health check endpoint or scheduled probe for known stores
- Alert notification (email, webhook, or dashboard) when a store's flavor fetch fails
- Retry logic with exponential backoff before triggering alert
- TBD: specific alerting service/channel to use
