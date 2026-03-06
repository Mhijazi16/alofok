# Deferred Items - Phase 13

## Pre-existing TypeScript Errors (out of scope)

These errors exist before phase 13 changes and are unrelated to offline caching:

1. `src/components/Admin/Overview.tsx(32,26)`: TS6133 - unused `onNavigate` parameter
2. `src/components/Admin/index.tsx(142,11)`: TS2322 - OrderItem missing `name` property
3. `src/components/Customer/index.tsx(329,13)`: TS2304 - `productName` not defined
4. `src/components/Sales/PaymentFlow.tsx(42,14)`: TS6133 - unused `i18n` import
