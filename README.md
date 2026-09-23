# Shooter Timer

Offline-first PWA for IPSC/TSV and ISSF pistol training. Live-fire shot detection (microphone onset) and dry-fire PAR / tap modes. No account, no backend.

## Scripts

- `npm run dev` — Vite on the LAN
- `npm run dev:https` — HTTPS via `@vitejs/plugin-basic-ssl` (needed for phone mic)
- `npm run test` / `npm run test:coverage` — Vitest, 100% on domain/application/ports/validation/storage/hooks/i18n + listed audio modules
- `npm run lint` / `npm run depcruise` / `npm run typecheck`
- `npm run test:e2e` — Playwright smoke (dry fire)
- `npm run build` / `npm run preview`

## Architecture

Hexagonal layers: `ui` → `hooks` → `application` → `domain` + `ports` ← `infra`. See `docs/adr/`.

## iOS / Android checklist (manual)

- Add to Home Screen (iOS: Share → Add to Home Screen)
- Keep the **screen on** and the app **in front** during a string — the browser cuts the mic when locked or backgrounded
- Live fire: unlocked phone, screen up, mic clear, on **your** side of the bay
- Start cue is **beep + full-screen flash** (flash can be disabled; respects reduced motion)
- Indoor neighbours can false-trigger — lower sensitivity or delete a shot on review
- Wake Lock may no-op on iOS PWA before 18.4; a silent audio loop is used as fallback

This is a training timer, not a match-certified CED/AMG.
