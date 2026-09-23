# ADR 002: Timer finite-state machine

## Status

Accepted

## Context

IPSC random-start, ISSF PAR countdown, and ISSF exposure windows cannot share one “beep then count up” procedure.

## Decision

A pure `reduceTimerState(state, event)` applies a closed `TimerEvent` union. `TimerProfileHandler` strategies schedule follow-up events. `RunController` is the only imperative orchestrator (clock, shot input, effects).

## Consequences

New procedures are new handlers + tests. UI cannot invent extra run state.
