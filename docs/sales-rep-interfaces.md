# Sales Rep — Interfaces & Flows Map

A map of every screen the sales rep touches and the flows between them.
Verified against the code as of 2026-07-22 (`main`).

## The 5 main tabs (bottom navigation)

```
┌──────────────────────────────────────────────────────────────┐
│  مساري      العملاء      الرئيسية      السلة 🔴      حسابي   │
│  Route     Customers     Catalog       Cart        Profile   │
└──────────────────────────────────────────────────────────────┘
```

| Tab | Component | Purpose |
|---|---|---|
| مساري | `RouteView` | Today's journey: customers by day, orders to deliver, collections |
| العملاء | `AllCustomersView` | Full customer list, search, add/edit/archive |
| الرئيسية | `OrderFlow` (no customer) | Browse the catalog freely |
| السلة | `CartView` | The cart, with badge counting lines |
| حسابي | `SalesProfileView` | Avatar, language (ar/en), logout |

## 1 · مساري (My Route) — home base

```
RouteView
 ├─ Date strip (2 weeks back ↔ 4 weeks forward, today auto-selected)
 ├─ Stats row ──► customers count · route debts · تحصيلات اليوم · المصاريف
 │                                        │
 │                                        └─► Collections popup — cash + cheques
 │                                            (cheque no. · due date · bank shown)
 ├─ Customer cards (paged, swipeable) ──► tap ──► CustomerDashboard  (see §3)
 │
 ├─ طلبات اليوم (route-day orders) ── header shows "N لم تُسلّم"
 │    each card: amber stripe + "لم يُسلّم" pulse  OR  green + "مُسلّم"
 │        │
 │        ├─ tap card ──► Order summary popup
 │        │                 ├─ items + per-item notes 📝 ("اللون أحمر")
 │        │                 ├─ حذف الطلب (reverses balance)
 │        │                 └─ تعديل الطلب ──► Order-Edit wizard (4 steps):
 │        │                        customer → products → date+notes → review
 │        │                        (prices & item notes preserved on edit)
 │        ├─ تأكيد التسليم / التراجع عن التسليم
 │        └─ long-press ──► multi-select ──► bulk deliver / undeliver
 │
 ├─ طلبات إضافية (bonus = off-route orders for that date) — same card behaviour
 └─ Morning briefing wizard (once per day, 4 slides)
```

Notes:

- An order appears under a day because of its **delivery date** (auto-set to the
  customer's route day when placing the order; the backend guarantees it is
  never empty).
- Delivered orders are locked against editing until "التراجع عن التسليم".

## 2 · Ordering flow (catalog → cart → order)

```
Catalog (OrderFlow)                    Cart (CartView)
 ├─ search / featured                   ├─ line: qty typeable + −/+
 ├─ product ──► detail overlay          ├─ line: 📝 إضافة ملاحظة → "اللون أحمر"
 ├─ options picker (variants)           ├─ order-level discount (₪ / %)
 └─ add ──► cart badge                  └─ تأكيد الطلب
                                              │
                                              ▼
                                   Confirm dialog: delivery date
                                   (auto = customer's route day;
                                    custom via checkbox — can't be cleared)
                                              │
                              online ─────────┴───────── offline
                                │                           │
                            POST /orders            sync-queue (IndexedDB)
                                                    flushed when back online,
                                                    idempotency keys = no dupes
```

- Per-item notes travel inside the order (`data.items[i].note`) and reappear in
  the My Route order popup and the edit wizard.
- The cart persists in `localStorage`, so an interrupted order survives an app
  restart.

## 3 · CustomerDashboard — the 7 actions

Reached by tapping any customer (from Route or Customers tab). Shows balance,
risk level and recent activity, then:

```
                        ┌────────────────────────────┐
                        │      CustomerDashboard     │
                        └─┬───┬───┬───┬───┬───┬───┬──┘
        ┌─────────────┐   │   │   │   │   │   │   │   ┌──────────────┐
 طلب جديد ◄───────────────┘   │   │   │   │   │   └──► شيك مرتجع
 (catalog with this           │   │   │   │   │       (returned cheques,
  customer pre-selected)      │   │   │   │   │        re-collect them)
                              │   │   │   │   │
 تحصيل (Collect wizard) ◄─────┘   │   │   │   └──────► تسوية (Settlement)
   step 1: كاش أم شيكات؟          │   │   │            enter agreed balance →
   ├─ Cash: amount+currency       │   │   │            posts رصيد افتتاحي line,
   │        → notes → review      │   │   │            statement lands on it
   └─ Cheque: سيريه أم عادي؟      │   │   │
      ├─ Series: shared details   │   │   └──────────► شراء (Purchase)
      │   → delta config          │   │                buy FROM customer,
      │   → edit generated rows   │   │                qty typeable
      └─ Normal: per-cheque rows, │   │
          each can override bank/ │   └──────────────► كشف حساب (Statement)
          account ("بنك مختلف")   │                    running balance, filters,
      → review → submit           │                    print / PDF export
      (bank-name autocomplete     │
       from past cheques)         └──────────────────► خصم (Discount)
                                                       forgive part of balance
                                                       (capped at what's owed)
```

Collect wizard details:

- **Series (سيريه):** shared bank details once → configure number delta
  (default 1) + date interval (months) + count → all cheques generated →
  editable list + one amount for all. A series is one bank/account by
  definition.
- **Normal:** one or more independent cheques; each can flip
  "بنك أو حساب مختلف" to carry its own bank / branch / account / holder.
- Cheque photos can be attached per cheque (queued offline too).
- Bank names are remembered per rep and suggested next time.

## 4 · Everything else

```
العملاء (Customers tab) ──► full list, search, add/edit customer (city, day,
                            phone…), archive — edits survive deploys
الرئيسية (Catalog tab)  ──► browse without a customer selected
حسابي (Profile)         ──► avatar, language (ar/en), logout
Offline banner          ──► shows pending-sync count whenever connectivity drops
```

## Where the money lives (one line each)

| Action | Statement line | Balance effect |
|---|---|---|
| طلب | `طلب +X` | debt up |
| تحصيل cash/cheque | `دفعة −X` | debt down |
| خصم | `خصم −X` | debt down (never below 0) |
| شراء | `شراء −X` | debt down |
| شيك مرتجع | `+X` (linked to original payment) | debt back up |
| تسوية | `رصيد افتتاحي` | jumps to the agreed figure |

Everything that creates money movement (order, collect, purchase, discount,
settlement) works offline through the same sync queue and is idempotent on
retry — a flaky connection can never double-charge a customer.

## Code map (where each piece lives)

| Screen / flow | File |
|---|---|
| Tab shell + routing | `frontend/src/components/Sales/index.tsx` |
| My Route | `frontend/src/components/Sales/RouteView.tsx` |
| Morning briefing | `frontend/src/components/Sales/RouteBriefing.tsx` |
| Customer dashboard | `frontend/src/components/Sales/CustomerDashboard.tsx` |
| Catalog / product picking | `frontend/src/components/Sales/OrderFlow.tsx` |
| Cart | `frontend/src/components/Sales/views/CartView.tsx` |
| Order summary + edit wizard | `frontend/src/components/Sales/OrderEditWizard.tsx` |
| Collect wizard (cash + cheques) | `frontend/src/components/Sales/collect/` |
| Discount dialog | `frontend/src/components/Sales/DiscountDialog.tsx` |
| Settlement dialog | `frontend/src/components/Sales/SettlementDialog.tsx` |
| Statement | `frontend/src/components/Sales/StatementView.tsx` |
| Returned cheques | `frontend/src/components/Sales/ReturnedChecksView.tsx` |
| Purchase from customer | `frontend/src/components/Sales/PurchaseFlow.tsx` |
| Customer add/edit form | `frontend/src/components/Sales/CustomerForm.tsx` |
| Offline sync queue | `frontend/src/lib/syncQueue.ts` + `frontend/src/hooks/useOfflineSync.ts` |
