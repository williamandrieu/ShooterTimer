# ADR 001: Hexagonal layers

## Status

Accepted

## Context

The shot timer must stay testable at 100% domain coverage, survive a future Capacitor shell, and keep React out of timing/audio rules.

## Decision

Organize the codebase as `ui` → `hooks` → `application` → `domain` + `ports` ← `infra`. Composition happens only in `src/app/createAppDeps.ts`. ESLint boundaries and dependency-cruiser enforce the directions.

## Consequences

New platform APIs land in `infra` behind existing ports. Domain tests never need jsdom except for hook/UI suites.
