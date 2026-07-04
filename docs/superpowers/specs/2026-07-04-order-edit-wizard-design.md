# Order-Edit Wizard — Design Spec

**Date:** 2026-07-04
**Status:** Approved (design), pending implementation plan
**Surfaces:** Sales rep order view (`RouteView`) + Admin Orders tab (`OrdersView`) — one shared component

## Problem

Tapping an existing order opens `components/Sales/OrderModal.tsx`, a two-tab (view/edit)
dialog. It can only edit **customer, delivery date, notes, and line quantities** (with
per-line remove). It **cannot add a new product** to the order, and its tabbed design is
not the desired UX. Users want an experience like the app-open "today's journey" briefing
(`RouteBriefing`): a multi-step slide wizard where each editable section is its own step,
navigated with Back/Next and ending in an animated success confirmation.

## Key findings that shape the design

1. **No backend change is required.** `PUT /orders/{id}` (`salesApi.updateOrder`) already
   accepts a full `items: OrderItem[]` replacement plus `customer_id`, `delivery_date`,
   `notes`, `discount_type`, `discount_value` (all optional). Adding a product is purely a
   missing UI affordance.
2. **The target wizard already exists as a primitive.** `components/ui/step-wizard.tsx`
   (`StepWizard`) powers `RouteBriefing`/`AdminBriefing`: direction-aware `motion/react`
   slide, per-step `canAdvance` gating, caller-driven `submitting`/`done` success screen,
   theming, `dir` (RTL), and `labels`. We reuse it directly.
3. **The create-flow product picker is reusable.** `OrderFlow` (catalog with live quantity
   steppers = add/edit/remove), `CustomerSelector`, and the `useCart` hook / `lib/cart.ts`
   are decoupled enough to drive from wizard state.
4. **Shape mismatch is the one real new piece.** The create flow uses
   `CartItem = { product: Product, quantity, selectedOptions }` (needs full `Product`),
   while the order/API uses `OrderItem = { product_id, name, image_url, quantity,
   unit_price, selected_options }` (flat, snake_case). An adapter bridges the two.

## Approach

**Assemble from existing primitives** (chosen over a custom in-wizard picker, which would
duplicate `OrderFlow`, and over bolting a picker into the current tabbed modal, which
keeps the disliked tabs). Least new code; visually identical to the app-open wizard.

## Components

### New: `lib/orderCart.ts` (pure adapter — the only genuinely new logic)

- `hydrateOrderItems(items: OrderItem[], products: Product[]): { cart: Map<string, CartItem>, legacy: OrderItem[] }`
  - For each order line, match `product_id` against `products`. On match, build a
    `CartItem` (recover full `Product`, map `selected_options` → `selectedOptions`, key via
    `cartKey`). On no match (product deleted/unavailable), push the raw `OrderItem` to
    `legacy` so it is never silently dropped.
- `serializeCart(cart: Map<string, CartItem>, legacy: OrderItem[]): OrderItem[]`
  - Map each `CartItem` → `OrderItem` (`product`→`product_id`/`name`/`image_url`,
    `getUnitPrice(product, options)`→`unit_price`, `selectedOptions`→`selected_options`),
    then append `legacy` lines unchanged.
- Pure and framework-free → unit tested in isolation.

### New: `components/Sales/OrderEditWizard.tsx`

- **Props:** `{ order: OrderWithCustomer | null, open: boolean, onOpenChange: (open: boolean) => void }`
  — a drop-in replacement for `OrderModal`.
- Owns local state: cart (`Map<string, CartItem>` seeded via `hydrateOrderItems`), `legacy`
  order lines, `customer_id`, `delivery_date`, `notes`.
- Fetches products (`salesApi.getProducts`) and customers (`salesApi.getMyCustomers`) —
  same queries `OrderFlow`/`OrderModal` already use (no extra network cost).
- Builds `WizardStep[]` and renders `StepWizard` with the same theme/`dir`/`labels` pattern
  as `RouteBriefing`.
- Preserves all three existing mutations: `updateOrder`, `deleteOrder`, `undeliver`.

### Reused as-is

- `StepWizard` — the wizard shell.
- `OrderFlow` — Products step body (catalog + live steppers reflecting cart state).
- `CustomerSelector` — Customer step body.
- `DatePicker` + `Textarea` — Delivery & Notes step body.
- Existing read-only line-item rendering — Review step body.

### Wiring

- **Sales:** `RouteView` renders `OrderEditWizard` instead of `OrderModal` at its existing
  three tap handlers; `selectedOrder`/`orderModalOpen` state unchanged.
- **Admin:** `OrdersView` renders the same `OrderEditWizard` from its order-row tap.
- `OrderModal` is removed once both call sites are migrated.

## Wizard steps

Non-delivered order, tapped → wizard opens at step 1:

1. **Customer** — `CustomerSelector`. `canAdvance` = a customer is selected.
2. **Products** — `OrderFlow` catalog with live quantity steppers (add new / change qty /
   remove via qty 0). Legacy/unavailable lines render as removable, qty-editable rows at the
   top with an "unavailable product" note. `canAdvance` = ≥1 line total (cart + legacy).
3. **Delivery & Notes** — `DatePicker` + `Textarea`. Always advances.
4. **Review** — read-only summary of customer, line items, total, date, notes. The
   Confirm button serializes and saves. Also hosts a destructive **Delete order** action.

## Data flow

Open → `hydrateOrderItems(order.data.items, products)` seeds cart + legacy → user edits
across steps → **Confirm** (Review) → `serializeCart` → `updateOrder(order.id, {
customer_id, items, delivery_date, notes })` → `StepWizard` `submitting` → on success
`done` triggers the animated check; invalidate the same query keys `OrderModal` used
(`delivery-orders`, plus route/insights as applicable). Wizard closes on success ack.

## Edge cases & decisions

- **Delivered orders stay locked** (current `canEdit = !isDelivered`). A delivered order
  opens to a **read-only single summary** (not the editable wizard), preserving the
  existing Undeliver and Delete actions. No accidental edits.
- **Legacy/deleted-product lines** are preserved through hydrate→serialize and shown in the
  Products step as removable, qty-editable rows (not re-pickable).
- **Discount** on an existing order is passed through unchanged. v1 does **not** add
  discount editing (YAGNI); the `updateOrder` payload already supports it if added later.
- **i18n:** new `orderEdit` namespace mirroring `briefing`'s step/label keys (`next`,
  `back`, `complete`, `done`, `close`, `step`, `successTitle`, `successHint`, plus step
  titles/hints), added to **both** `locales/ar.json` and `locales/en.json`. RTL via
  `i18n.language`, matching `RouteBriefing`.

## Testing

- **Unit (`lib/orderCart.ts`):** hydrate→serialize round-trip preserves items; options and
  unit prices map correctly; legacy (unmatched-product) lines survive both directions;
  removing all matched items still keeps legacy lines countable for `canAdvance`.
- **Manual/E2E:** add a product to an existing order; change a quantity; swap customer;
  change date/notes; Confirm and verify the `PUT /orders/{id}` payload; confirm a delivered
  order opens read-only with Undeliver/Delete intact.

## Out of scope (v1)

- Discount editing within the wizard.
- Backend changes (none needed).
- Changes to order *creation* flow.
