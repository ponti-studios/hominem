---
title: 'Remove the legacy server Time parser after Omiro adoption'
status: 'Proposed'
priority: 'medium'
labels: [omiro, api, cleanup]
depends_on: [omiro-on-device-calendar.md]
blocks: []
estimated_size: 'M'
---

## Adoption gate

After the replacement Omiro build ships, observe the payload-free invocation
metric for `/api/tasks/parse`. Remove the endpoint only after fourteen
consecutive days with zero calls. If calls remain after sixty days, stop and
request a product decision; do not break older clients by assumption.

## Scope after the gate

Remove the route, extraction service, prompt, model configuration, RPC parse
types, and obsolete evaluations. Historical AI usage records and display labels
for `time_block_extract` remain readable.
