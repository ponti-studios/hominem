---
title: 'Retain the server Time parser for web task management'
status: 'Proposed'
priority: 'medium'
labels: [web, omiro, api]
depends_on: []
blocks: []
estimated_size: 'M'
---

## Product boundary

`POST /api/tasks/parse` is a supported server capability for web task
management and older Omiro builds. The device-only Calendar rollout changes
only the source of calendar data for current Omiro builds; it does not change
the parser's supported status or authorize removing the endpoint.

## Constraints

- Keep the route, extraction service, prompt, model configuration, and RPC
  parse types available.
- Current Omiro builds must not send calendar payloads to this endpoint.
- Any future deprecation or removal requires an explicit product decision
  covering web task management and older Omiro clients.
