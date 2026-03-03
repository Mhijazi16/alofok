# Frontend Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the Alofok frontend with 7 changes: floating glass nav, image fix, customer CRUD, extended product fields, product grid+expandable cards, full-page cart, and admin product tabs.

**Architecture:** Backend-first for schema changes (customer fields, product fields, new endpoints), then frontend changes layer by layer — shared utilities first, then component-level changes per role shell.

**Tech Stack:** React, Tailwind, FastAPI, SQLAlchemy, Alembic, Leaflet/react-leaflet, Bun

---

## Task 1: Image URL Utility

**Files:**
- Create: `frontend/src/lib/image.ts`

**Step 1: Create getImageUrl helper**

```typescript
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}
```

**Step 2: Verify file exists**

Run: `cat frontend/src/lib/image.ts`

**Step 3: Commit**

```bash
git add frontend/src/lib/image.ts
git commit -m "feat: add getImageUrl utility for API-relative image paths"
```

---

## Task 2: Apply getImageUrl Across All Components

**Files:**
- Modify: `frontend/src/components/Sales/OrderFlow.tsx` (all `product.image_url` usages)
- Modify: `frontend/src/components/Designer/ProductList.tsx` (product image rendering)
- Modify: `frontend/src/components/Designer/ProductForm.tsx` (preview image and edit mode)

**Step 1: Update OrderFlow.tsx**

Add import at top:
```typescript
import { getImageUrl } from "@/lib/image";
```

Replace every `src={product.image_url}` with `src={getImageUrl(product.image_url)!}` (there are ~2 locations: product card image and cart item image).

**Step 2: Update ProductList.tsx**

Same pattern — import `getImageUrl`, replace `src={p.image_url}` with `src={getImageUrl(p.image_url)!}`.

**Step 3: Update ProductForm.tsx**

Import `getImageUrl`. In edit mode preview where it shows the existing image_url, wrap with `getImageUrl()`.

**Step 4: Verify build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

**Step 5: Commit**

```bash
git add frontend/src/components/Sales/OrderFlow.tsx frontend/src/components/Designer/ProductList.tsx frontend/src/components/Designer/ProductForm.tsx
git commit -m "fix: prepend API base URL to product image paths"
```

---

## Task 3: Floating Glass Bottom Nav

**Files:**
- Modify: `frontend/src/components/ui/bottom-nav.tsx`
- Modify: `frontend/src/components/layout/app-shell.tsx`

**Step 1: Restyle BottomNav as floating glass bar**

Replace the outer `<nav>` className in `bottom-nav.tsx`:

Old:
```
"fixed inset-x-0 bottom-0 z-40 glass-strong pb-safe"
```

New:
```
"fixed z-40 bottom-4 inset-x-4 mx-auto max-w-lg rounded-2xl border border-border/50 bg-background/60 backdrop-blur-xl shadow-lg shadow-black/20 pb-safe"
```

This makes it: floating (bottom-4 inset-x-4), centered (mx-auto max-w-lg), rounded, glass effect (bg-background/60 backdrop-blur-xl), with a subtle border and shadow.

**Step 2: Make BottomNav visible on desktop too**

In `app-shell.tsx`, remove the `lg:hidden` wrapper around bottomNav. Change line 43 from:
```tsx
{bottomNav && <div className="lg:hidden">{bottomNav}</div>}
```
to:
```tsx
{bottomNav && <div>{bottomNav}</div>}
```

Also update the main content padding — change `bottomNav && "pb-20"` to `bottomNav && "pb-24"` to account for the floating offset.

**Step 3: Verify visually**

Run: `cd frontend && bun dev`
Check both mobile and desktop widths — nav should float centered with blur at both sizes.

**Step 4: Commit**

```bash
git add frontend/src/components/ui/bottom-nav.tsx frontend/src/components/layout/app-shell.tsx
git commit -m "feat: floating glass bottom nav visible on all screen sizes"
```

---

## Task 4: Desktop-Friendly Content Containers

**Files:**
- Modify: `frontend/src/components/Sales/index.tsx`
- Modify: `frontend/src/components/Designer/index.tsx`
- Modify: `frontend/src/components/Admin/index.tsx`

**Step 1: Sales shell — remove sidebar reliance, use bottom nav for all sizes**

The Sales shell already uses BottomNav. After Task 3, it's visible on desktop. Wrap main content area in a responsive container:

In the main content wrapper, add `max-w-6xl mx-auto w-full px-4 lg:px-8` to center and constrain content on large screens.

**Step 2: Designer shell — add bottom nav alongside sidebar, or switch to bottom nav only**

The Designer currently uses Sidebar on desktop and BottomNav on mobile. To unify: keep BottomNav as the primary nav for all sizes. Remove the Sidebar from the Designer shell. Pass the same nav items to BottomNav. Wrap content in `max-w-6xl mx-auto w-full px-4 lg:px-8`.

**Step 3: Admin shell — same treatment**

Admin uses Sidebar + BottomNav. Switch to BottomNav-only. Add the new product tabs. Wrap content in `max-w-6xl mx-auto w-full px-4 lg:px-8`.

**Step 4: Verify build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

**Step 5: Commit**

```bash
git add frontend/src/components/Sales/index.tsx frontend/src/components/Designer/index.tsx frontend/src/components/Admin/index.tsx
git commit -m "feat: desktop-friendly content containers with unified floating nav"
```

---

## Task 5: Admin Gets Product Tabs

**Files:**
- Modify: `frontend/src/components/Admin/index.tsx`

**Step 1: Import Designer components**

```typescript
import { ProductList } from "@/components/Designer/ProductList";
import { ProductForm } from "@/components/Designer/ProductForm";
```

**Step 2: Extend view types**

Add `"products"` and `"addProduct"` and `"editProduct"` to the Admin view type union.

**Step 3: Add nav items**

Add to the BottomNav items array:
- `{ icon: Package, label: t("nav.products"), value: "products" }`
- `{ icon: PlusCircle, label: t("nav.addProduct"), value: "addProduct" }`

**Step 4: Add view rendering**

In the view switch/conditional rendering, add cases:
- `"products"` → render `<ProductList>` with onEdit callback that sets view to "editProduct" and stores selected product
- `"addProduct"` → render `<ProductForm>` with onDone callback that sets view to "products"
- `"editProduct"` → render `<ProductForm product={editingProduct}>` with same onDone

**Step 5: Verify build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

**Step 6: Commit**

```bash
git add frontend/src/components/Admin/index.tsx
git commit -m "feat: admin shell gets product catalog and add product tabs"
```

---

## Task 6: Backend — Extend Customer Model

**Files:**
- Modify: `backend/app/models/customer.py`
- Modify: `backend/app/schemas/customer.py`
- Create: Alembic migration

**Step 1: Add new fields to Customer model**

In `backend/app/models/customer.py`, add after `balance`:

```python
phone = Column(String, nullable=True)
address = Column(String, nullable=True)
latitude = Column(Numeric(10, 7), nullable=True)
longitude = Column(Numeric(10, 7), nullable=True)
avatar_url = Column(String, nullable=True)
notes = Column(Text, nullable=True)
```

Import `Text` from sqlalchemy if not already imported.

**Step 2: Update schemas**

In `backend/app/schemas/customer.py`:

Update `CustomerOut` to include the new fields:
```python
phone: str | None = None
address: str | None = None
latitude: float | None = None
longitude: float | None = None
avatar_url: str | None = None
notes: str | None = None
```

Add new schemas:
```python
class CustomerCreate(BaseModel):
    name: str
    phone: str | None = None
    city: str
    address: str | None = None
    assigned_day: str
    latitude: float | None = None
    longitude: float | None = None
    avatar_url: str | None = None
    notes: str | None = None

class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    city: str | None = None
    address: str | None = None
    assigned_day: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    avatar_url: str | None = None
    notes: str | None = None
```

**Step 3: Generate migration**

Run: `cd backend && alembic revision --autogenerate -m "add customer phone address location avatar notes"`

**Step 4: Run migration**

Run: `cd backend && alembic upgrade head`

**Step 5: Commit**

```bash
git add backend/app/models/customer.py backend/app/schemas/customer.py backend/alembic/versions/
git commit -m "feat: extend customer model with phone, address, location, avatar, notes"
```

---

## Task 7: Backend — Customer CRUD Endpoints

**Files:**
- Modify: `backend/app/api/endpoints/customers.py`
- Modify: `backend/app/services/customer_service.py`
- Modify: `backend/app/repositories/customer_repository.py`

**Step 1: Add create method to CustomerRepository**

```python
async def create(self, data: dict) -> Customer:
    customer = Customer(**data)
    self.db.add(customer)
    await self.db.commit()
    await self.db.refresh(customer)
    return customer

async def update(self, customer_id: UUID, data: dict) -> Customer | None:
    customer = await self.get_by_id(customer_id)
    if not customer or customer.is_deleted:
        return None
    for k, v in data.items():
        if v is not None:
            setattr(customer, k, v)
    await self.db.commit()
    await self.db.refresh(customer)
    return customer
```

**Step 2: Add service methods to CustomerService**

```python
async def create_customer(self, data: CustomerCreate, user_id: UUID) -> Customer:
    customer_dict = data.model_dump()
    customer_dict["assigned_to"] = user_id
    return await self.customer_repo.create(customer_dict)

async def update_customer(self, customer_id: UUID, data: CustomerUpdate, user_id: UUID, role: str) -> Customer:
    # Sales can only edit own customers
    if role == "Sales":
        customer = await self.customer_repo.get_by_id(customer_id)
        if not customer or customer.assigned_to != user_id:
            raise HorizonException(403, "Cannot edit this customer")
    updated = await self.customer_repo.update(customer_id, data.model_dump(exclude_none=True))
    if not updated:
        raise HorizonException(404, "Customer not found")
    # invalidate route cache
    await self.cache.invalidate_prefix("route:")
    return updated
```

**Step 3: Add avatar upload endpoint and customer CRUD to customers.py**

Add to `backend/app/api/endpoints/customers.py`:

```python
@router.post("/upload-avatar", response_model=dict)
async def upload_avatar(file: UploadFile, user: CurrentUser = require_sales):
    # Same pattern as product image upload
    ext = Path(file.filename).suffix or ".jpg"
    filename = f"{uuid4()}{ext}"
    path = Path("static/avatars") / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(path, "wb") as f:
        await f.write(await file.read())
    return {"url": f"/static/avatars/{filename}"}

@router.post("/", response_model=CustomerOut)
async def create_customer(body: CustomerCreate, user: CurrentUser = require_sales, svc: CustomerSvc):
    return await svc.create_customer(body, UUID(user["sub"]))

@router.put("/{customer_id}", response_model=CustomerOut)
async def update_customer(customer_id: UUID, body: CustomerUpdate, user: CurrentUser = require_sales, svc: CustomerSvc):
    return await svc.update_customer(customer_id, body, UUID(user["sub"]), user["role"])
```

**Step 4: Format and verify**

Run: `cd backend && black . && python -c "from app.main import app; print('OK')"`

**Step 5: Commit**

```bash
git add backend/app/api/endpoints/customers.py backend/app/services/customer_service.py backend/app/repositories/customer_repository.py
git commit -m "feat: customer CRUD endpoints for sales reps"
```

---

## Task 8: Backend — Extend Product Model

**Files:**
- Modify: `backend/app/models/product.py`
- Modify: `backend/app/schemas/product.py`
- Create: Alembic migration

**Step 1: Add new fields to Product model**

In `backend/app/models/product.py`, add after `is_bestseller`:

```python
description_ar = Column(Text, nullable=True)
description_en = Column(Text, nullable=True)
discount_percentage = Column(Numeric(5, 2), nullable=True)
discounted_price = Column(Numeric(12, 2), nullable=True)
category = Column(String, nullable=True)
brand = Column(String, nullable=True)
stock_qty = Column(Integer, nullable=True)
unit = Column(String, default="piece")
weight = Column(Numeric(8, 2), nullable=True)
color_options = Column(JSONB, nullable=True)
```

Import `Integer, Text` from sqlalchemy and `JSONB` from `sqlalchemy.dialects.postgresql`.

**Step 2: Update schemas**

In `backend/app/schemas/product.py`, add all new fields to `ProductOut`, `ProductCreate` (optional with defaults), and `ProductUpdate` (all optional).

**Step 3: Generate and run migration**

Run: `cd backend && alembic revision --autogenerate -m "add product description discount category brand stock unit weight colors"`
Run: `cd backend && alembic upgrade head`

**Step 4: Commit**

```bash
git add backend/app/models/product.py backend/app/schemas/product.py backend/alembic/versions/
git commit -m "feat: extend product model with description, discount, category, stock, unit, weight, colors"
```

---

## Task 9: Frontend — Update API Types

**Files:**
- Modify: `frontend/src/services/salesApi.ts`
- Modify: `frontend/src/services/designerApi.ts`

**Step 1: Update Product interface in salesApi.ts**

Add to the Product interface (lines 5-14):
```typescript
description_ar?: string | null;
description_en?: string | null;
discount_percentage?: number | null;
discounted_price?: number | null;
category?: string | null;
brand?: string | null;
stock_qty?: number | null;
unit?: string;
weight?: number | null;
color_options?: string[] | null;
```

**Step 2: Update Customer interface in salesApi.ts**

Add to the Customer interface (lines 16-22):
```typescript
phone?: string | null;
address?: string | null;
latitude?: number | null;
longitude?: number | null;
avatar_url?: string | null;
notes?: string | null;
```

**Step 3: Add customer CRUD endpoints to salesApi**

```typescript
createCustomer: (body: CustomerCreate) =>
  api.post<Customer>("/customers", body),
updateCustomer: (id: string, body: CustomerUpdate) =>
  api.put<Customer>(`/customers/${id}`, body),
uploadAvatar: (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post<{ url: string }>("/customers/upload-avatar", form);
},
```

Add `CustomerCreate` and `CustomerUpdate` interfaces.

**Step 4: Update designerApi.ts ProductCreate/ProductUpdate**

Add all new product fields to both interfaces.

**Step 5: Verify build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

**Step 6: Commit**

```bash
git add frontend/src/services/salesApi.ts frontend/src/services/designerApi.ts
git commit -m "feat: update frontend API types for extended product and customer fields"
```

---

## Task 10: Frontend — Extended ProductForm

**Files:**
- Modify: `frontend/src/components/Designer/ProductForm.tsx`

**Step 1: Add new form fields organized in sections**

Reorganize the form into collapsible/visible sections:

1. **Basic Info** (existing: name_ar, name_en, sku) + new: description_ar (Textarea), description_en (Textarea)
2. **Pricing** (existing: price) + new: discount_percentage (Input number), discounted_price (auto-computed Input), is_discounted toggle
3. **Inventory**: stock_qty (Input number), unit (Select: piece/box/carton/kg/liter), weight (Input number)
4. **Attributes**: category (Input), brand (Input), color_options (comma-separated Input → split to array)
5. **Media**: image upload (existing)
6. **Flags**: is_bestseller toggle (existing)

Auto-compute `discounted_price` when `price` and `discount_percentage` change:
```typescript
const computedDiscountedPrice = price && discountPercentage
  ? +(price * (1 - discountPercentage / 100)).toFixed(2)
  : undefined;
```

**Step 2: Update live preview to show new fields**

Show description, strikethrough original price + discounted price, unit badge, stock indicator, color dots.

**Step 3: Verify build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

**Step 4: Commit**

```bash
git add frontend/src/components/Designer/ProductForm.tsx
git commit -m "feat: extended product form with description, discount, inventory, attributes"
```

---

## Task 11: Frontend — CustomerForm Component

**Files:**
- Create: `frontend/src/components/Sales/CustomerForm.tsx`
- Modify: `frontend/src/components/Sales/index.tsx` (add "customerForm" view)
- Modify: `frontend/src/components/Sales/RouteView.tsx` (add "Add Customer" button)
- Modify: `frontend/src/components/Sales/CustomerDashboard.tsx` (add "Edit" button)

**Step 1: Install Leaflet**

Run: `cd frontend && bun add leaflet react-leaflet @types/leaflet`

**Step 2: Create CustomerForm.tsx**

Fields:
- name (required Input)
- phone (Input type="tel")
- city (Input)
- address (Input)
- notes (Textarea)
- avatar (FileUpload → calls salesApi.uploadAvatar)
- Map picker (MapContainer + TileLayer + click handler → sets lat/lng marker)

Map setup:
```typescript
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
```

Default center: [31.9, 35.2] (Palestine region), zoom 10. Click places marker and updates lat/lng state.

Props: `customer?: Customer` (edit mode), `onDone: () => void`, `onBack: () => void`.

On submit: calls `salesApi.createCustomer` or `salesApi.updateCustomer`, then `onDone()`.

**Step 3: Wire into Sales shell**

In `index.tsx`, add `"customerForm"` to view type. Add navigation from RouteView (FAB button) and CustomerDashboard (edit button in header).

**Step 4: Add "Add Customer" FAB to RouteView**

At the bottom of RouteView, add a floating action button:
```tsx
<button onClick={onAddCustomer} className="fixed bottom-24 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
  <Plus className="h-6 w-6" />
</button>
```

**Step 5: Add "Edit" button to CustomerDashboard header**

In the customer info card, add an edit icon button that calls `onEditCustomer(customer)`.

**Step 6: Verify build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

**Step 7: Commit**

```bash
git add frontend/src/components/Sales/CustomerForm.tsx frontend/src/components/Sales/index.tsx frontend/src/components/Sales/RouteView.tsx frontend/src/components/Sales/CustomerDashboard.tsx
git commit -m "feat: customer create/edit form with map picker and avatar upload"
```

---

## Task 12: Frontend — Product Grid + Expandable Cards in OrderFlow

**Files:**
- Modify: `frontend/src/components/Sales/OrderFlow.tsx`

**Step 1: Add view toggle state**

```typescript
const [viewMode, setViewMode] = useState<"grid" | "list">(
  () => (localStorage.getItem("catalog-view") as "grid" | "list") || "grid"
);
```

Persist on change: `localStorage.setItem("catalog-view", viewMode)`.

**Step 2: Add toggle to TopBar actions**

```tsx
<button onClick={() => setViewMode(v => v === "grid" ? "list" : "grid")}>
  {viewMode === "grid" ? <List className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
</button>
```

**Step 3: Build grid view**

```tsx
{viewMode === "grid" ? (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
    {filteredProducts.map(p => (
      <ProductGridCard
        key={p.id}
        product={p}
        expanded={expandedId === p.id}
        onToggle={() => setExpandedId(prev => prev === p.id ? null : p.id)}
        onAddToCart={addToCart}
        cartQty={cart.get(p.id)?.quantity ?? 0}
      />
    ))}
  </div>
) : (
  /* existing list view */
)}
```

**Step 4: Build ProductGridCard inline or as local component**

Card structure:
- Image (aspect-[3/4], object-cover, rounded-xl) or Package icon fallback
- Overlay badges (bestseller, discounted)
- Name + price below image
- On tap: `expanded` state toggles
- Expanded section (animated): description, price breakdown (original strikethrough + discounted), unit/color selectors if available, quantity picker (+/-), "Add to Cart" button
- Animation: `overflow-hidden transition-all duration-300` with max-height toggle

**Step 5: Add expandedId state**

```typescript
const [expandedId, setExpandedId] = useState<string | null>(null);
```

**Step 6: Verify build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

**Step 7: Commit**

```bash
git add frontend/src/components/Sales/OrderFlow.tsx
git commit -m "feat: product grid view with expandable cards and list/grid toggle"
```

---

## Task 13: Frontend — Full-Page Cart

**Files:**
- Modify: `frontend/src/components/Sales/OrderFlow.tsx` (extract cart to separate view)
- Modify: `frontend/src/components/Sales/index.tsx` (add "cart" view)

**Step 1: Lift cart state to Sales index**

Move the cart `Map<string, CartItem>` state from OrderFlow up to Sales index.tsx so it persists across views. Pass down as props to OrderFlow and CartView.

Also persist to localStorage:
```typescript
const [cart, setCart] = useState<Map<string, CartItem>>(() => {
  const saved = localStorage.getItem("cart");
  return saved ? new Map(JSON.parse(saved)) : new Map();
});
useEffect(() => {
  localStorage.setItem("cart", JSON.stringify([...cart]));
}, [cart]);
```

**Step 2: Create CartView as a section inside OrderFlow or a separate inline component**

Full-page cart view:
- TopBar: "Cart" title + back button + item count
- Item list: each item has product image (getImageUrl), name, unit price, quantity controls (+/-), line total, remove (Trash2) button
- Order summary card at bottom: subtotal, item count
- "Place Order" full-width gradient button
- Empty state: ShoppingCart icon + "Cart is empty" + "Browse Catalog" button

**Step 3: Add cart badge to Sales nav**

In the BottomNav items for catalog, add `badge: cart.size` or add a dedicated cart nav item.

Alternatively, add a cart nav item:
```typescript
{ icon: ShoppingCart, label: t("catalog.cart"), value: "cart", badge: cart.size || undefined }
```

**Step 4: Remove the old cart dialog from OrderFlow**

Replace the cart dialog trigger with a simple "View Cart" button or rely on the nav badge.

**Step 5: Verify build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

**Step 6: Commit**

```bash
git add frontend/src/components/Sales/OrderFlow.tsx frontend/src/components/Sales/index.tsx
git commit -m "feat: full-page cart replacing dialog, with persistent cart state"
```

---

## Task 14: Localization — Add All New Keys

**Files:**
- Modify: `frontend/src/locales/en.json`
- Modify: `frontend/src/locales/ar.json`

**Step 1: Add new keys to en.json**

```json
{
  "customer": {
    "phone": "Phone",
    "address": "Address",
    "location": "Location",
    "avatar": "Photo",
    "notes": "Notes",
    "addNew": "Add Customer",
    "editCustomer": "Edit Customer",
    "tapToSetLocation": "Tap map to set location",
    "locationSet": "Location set",
    "savedSuccess": "Customer saved successfully"
  },
  "product": {
    "descriptionAr": "Description (Arabic)",
    "descriptionEn": "Description (English)",
    "discountPercentage": "Discount %",
    "discountedPrice": "Discounted Price",
    "category": "Category",
    "brand": "Brand",
    "stockQty": "Stock Quantity",
    "unit": "Unit",
    "weight": "Weight",
    "colorOptions": "Color Options",
    "unitOptions": {
      "piece": "Piece",
      "box": "Box",
      "carton": "Carton",
      "kg": "Kilogram",
      "liter": "Liter"
    },
    "basicInfo": "Basic Information",
    "pricing": "Pricing",
    "inventory": "Inventory",
    "attributes": "Attributes"
  },
  "cart": {
    "title": "Cart",
    "empty": "Your cart is empty",
    "browseCatalog": "Browse Catalog",
    "subtotal": "Subtotal",
    "placeOrder": "Place Order",
    "itemCount": "{{count}} items"
  },
  "catalog": {
    "gridView": "Grid View",
    "listView": "List View"
  }
}
```

**Step 2: Add corresponding Arabic keys to ar.json**

```json
{
  "customer": {
    "phone": "الهاتف",
    "address": "العنوان",
    "location": "الموقع",
    "avatar": "الصورة",
    "notes": "ملاحظات",
    "addNew": "إضافة عميل",
    "editCustomer": "تعديل العميل",
    "tapToSetLocation": "اضغط على الخريطة لتحديد الموقع",
    "locationSet": "تم تحديد الموقع",
    "savedSuccess": "تم حفظ العميل بنجاح"
  },
  "product": {
    "descriptionAr": "الوصف (عربي)",
    "descriptionEn": "الوصف (إنجليزي)",
    "discountPercentage": "نسبة الخصم %",
    "discountedPrice": "السعر بعد الخصم",
    "category": "الفئة",
    "brand": "العلامة التجارية",
    "stockQty": "الكمية المتوفرة",
    "unit": "الوحدة",
    "weight": "الوزن",
    "colorOptions": "خيارات الألوان",
    "unitOptions": {
      "piece": "قطعة",
      "box": "صندوق",
      "carton": "كرتون",
      "kg": "كيلوغرام",
      "liter": "لتر"
    },
    "basicInfo": "المعلومات الأساسية",
    "pricing": "التسعير",
    "inventory": "المخزون",
    "attributes": "الخصائص"
  },
  "cart": {
    "title": "السلة",
    "empty": "سلة المشتريات فارغة",
    "browseCatalog": "تصفح المنتجات",
    "subtotal": "المجموع",
    "placeOrder": "تأكيد الطلب",
    "itemCount": "{{count}} عناصر"
  },
  "catalog": {
    "gridView": "عرض شبكي",
    "listView": "عرض قائمة"
  }
}
```

Note: Merge these into the existing JSON — don't overwrite existing keys.

**Step 3: Commit**

```bash
git add frontend/src/locales/en.json frontend/src/locales/ar.json
git commit -m "feat: add localization keys for customer form, extended products, cart, grid view"
```

---

## Task Dependency Order

```
Task 1 (image util) → Task 2 (apply to components)
Task 3 (floating nav) → Task 4 (desktop containers) → Task 5 (admin product tabs)
Task 6 (backend customer) → Task 7 (backend customer endpoints) → Task 9 (frontend types) → Task 11 (customer form)
Task 8 (backend product) → Task 9 (frontend types) → Task 10 (product form)
Task 9 (frontend types) → Task 12 (grid + expandable) → Task 13 (full-page cart)
Task 14 (localization) — can run in parallel with any frontend task but should be done before final verification
```

**Suggested execution waves:**
1. **Wave 1** (parallel): Tasks 1, 3, 6, 8, 14
2. **Wave 2** (parallel): Tasks 2, 4, 7
3. **Wave 3** (parallel): Tasks 5, 9
4. **Wave 4** (parallel): Tasks 10, 11, 12
5. **Wave 5**: Task 13

---
