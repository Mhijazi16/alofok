---
phase: quick-2
plan: "01"
subsystem: ui
tags: [pwa, ios, safe-area, bottom-nav, css]
one_liner: "Fix bottom navbar stretching on iPhone PWA by replacing pb-safe padding with bottom position offset"
---

# Quick Task 2: Fix bottom navbar safe area on iPhone PWA

## What changed

- `bottom-nav.tsx`: Removed `pb-safe` class (which added internal padding via `env(safe-area-inset-bottom)`) and replaced `bottom-6` with dynamic `bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]`
- Scroll-hide translate also accounts for safe area inset

## Root cause

In standalone PWA mode (`viewport-fit=cover`), `env(safe-area-inset-bottom)` is ~34px on iPhones with home indicator. The `pb-safe` class added this as internal padding, stretching the navbar's visible background/border down into the rounded corner zone. The fix moves the entire navbar up by the safe area amount instead.

## Files modified

- `frontend/src/components/ui/bottom-nav.tsx` — 1 file, 3 insertions, 2 deletions
