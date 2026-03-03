# Frontend Overhaul Design — 2026-03-02

## Summary

Six changes to the Alofok frontend plus a cross-cutting responsive/desktop improvement.

---

## 1. Responsive Desktop Layout + Floating Glass Nav

**Problem:** Bottom nav is invisible on desktop. App is mobile-only.

**Design:**
- All three role shells (Sales, Designer, Admin) share the same responsive nav behavior
- **Mobile (< lg):** Floating bottom nav bar — `backdrop-blur-xl`, `bg-background/60`, `rounded-2xl`, subtle border+shadow, pinned ~16px above bottom edge, centered horizontally
- **Desktop (>= lg):** Same floating bar but wider, centered at bottom of viewport, with text labels next to icons
- Content containers get `max-w-6xl mx-auto` with padding on desktop
- TopBar becomes a sticky header with proper desktop width

## 2. Product Images Fix

**Problem:** `image_url` stored as `/static/products/uuid.jpg` (relative). Frontend `<img src>` doesn't prepend API base URL.

**Fix:** Create a `getImageUrl(path)` utility that prepends `VITE_API_URL` (or falls back to `window.location.origin`) to relative paths starting with `/static/`. Apply to all `<img src={product.image_url}>` usages in ProductList, OrderFlow, and ProductForm preview.

## 3. Customer CRUD for Sales Reps

### Backend Changes

**New Customer model fields (Alembic migration):**
- `phone` — String, nullable
- `address` — String, nullable
- `latitude` — Float, nullable
- `longitude` — Float, nullable
- `avatar_url` — String, nullable
- `notes` — Text, nullable

**New endpoints:**
- `POST /customers` — Sales/Admin creates customer, auto-assigns to current user (Sales) or specified rep (Admin)
- `PUT /customers/{id}` — Sales edits own customer, Admin edits any
- `POST /customers/upload-avatar` — Avatar upload returning `{url: "/static/avatars/uuid.ext"}`

**New schemas:** `CustomerCreate`, `CustomerUpdate` with all new fields.

### Frontend Changes

**CustomerForm.tsx** — New component under `Sales/`:
- Fields: name (required), phone, city, address, notes (textarea)
- Interactive map picker: Leaflet + OpenStreetMap tiles (no API key), tap-to-place pin for lat/lng
- Avatar upload via FileUpload component
- Accessible from:
  - RouteView: "Add Customer" floating action button
  - CustomerDashboard: "Edit" button in customer header

**Dependencies:** `leaflet`, `react-leaflet` (add via bun)

## 4. Extended Product Fields

### Backend Changes

**New Product model fields (Alembic migration):**
- `description_ar` — Text, nullable
- `description_en` — Text, nullable
- `discount_percentage` — Decimal(5,2), nullable
- `discounted_price` — Decimal(12,2), nullable
- `category` — String, nullable
- `brand` — String, nullable
- `stock_qty` — Integer, nullable
- `unit` — String, default "piece" (piece/box/carton/kg/liter)
- `weight` — Decimal(8,2), nullable
- `color_options` — JSONB, nullable (array of strings)

**Update schemas:** Add all new fields to `ProductCreate` (optional) and `ProductUpdate`.

### Frontend Changes

**ProductForm.tsx** — Reorganize into sections:
1. **Basic Info:** name_ar, name_en, sku, description_ar, description_en
2. **Pricing:** price, discount_percentage, discounted_price (auto-calculated), is_discounted toggle
3. **Inventory:** stock_qty, unit (select), weight
4. **Attributes:** category, brand, color_options (tag input)
5. **Media:** image upload (existing)
6. **Flags:** is_bestseller toggle

Live preview extended to show new fields.

## 5. Product Grid + Expandable Cards in OrderFlow

**Two-view toggle** in OrderFlow top bar:
- Icons: `LayoutGrid` (grid) / `List` (list)
- Preference stored in localStorage

**Grid view (new default):**
- 2 cols mobile, 3 cols tablet, 4 cols desktop
- Cards: product image (`aspect-[3/4]`), name, price, discount badge overlay
- Large, touch-friendly cards

**Expandable card:**
- Tapping a card expands it in-place (animated height + fade)
- Expanded content: full description, price breakdown (original strikethrough + discounted price), unit selector, color selector (if options exist), quantity picker, "Add to Cart" button
- Tap again or X button to collapse
- Only one card expanded at a time

**List view:** Existing compact layout preserved.

## 6. Full-Page Cart

**Replace cart dialog with a dedicated `"cart"` view** in Sales navigation:
- Cart icon with badge count in the floating nav
- **Cart page contents:**
  - Item list: product image, name, unit price, quantity controls (+/-), line total, remove button
  - Swipe-to-delete on mobile
  - Order summary: subtotal, item count
  - "Place Order" button (full-width gradient)
  - Empty state when cart is empty with "Browse Catalog" link
- Cart state persisted in localStorage for offline support

## 7. Admin Gets Product Tabs

**Admin shell navigation updated to include:**
- Overview
- **Products** (reuses Designer's ProductList component)
- **Add Product** (reuses Designer's ProductForm component)
- Sales Stats
- Debt Stats
- Customer Import
- Profile

No component duplication — Admin imports and renders the same ProductList/ProductForm components.

---

## Localization

All new UI strings added to both `ar.json` and `en.json`. New keys needed for:
- Customer form labels (phone, address, notes, location, avatar)
- Product form section headers and new field labels
- Cart page strings
- Grid/list toggle labels
- Map picker instructions

## Dependencies to Add

- `leaflet` + `react-leaflet` — interactive map picker for customer location
- `@types/leaflet` — TypeScript definitions
