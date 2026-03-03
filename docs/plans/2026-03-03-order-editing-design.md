# Order Editing Feature Design

**Date**: 2026-03-03
**Feature**: Edit orders before delivery, confirm delivery to lock orders

## Overview

Sales representatives need the ability to edit orders before delivery. Once delivery is confirmed, orders are locked and cannot be modified. This allows corrections and adjustments to be made before the order is completed.

## Key Requirements

1. **Order Locking**: Orders are locked AFTER delivery confirmation (not after payment)
2. **Delivery Confirmation**: Button on order card to mark as delivered
3. **Order Editing**: Only allowed before delivery
4. **Modal Interface**: Modal with two tabs — "View Products" and "Edit Order"
5. **Product Images**: All product displays show images, not just names
6. **Customer Selection**: Custom UI with avatar-based customer picker with search

## Design Details

### 1. Order Card Actions

**Visible on all order cards:**
- New button: "Confirm Delivery" (visible only if order not yet delivered)
- Click order to open edit modal

### 2. Order Modal (Dialog)

Two-tab interface:

#### Tab A: View Products (Read-only)
- Product cards displaying:
  - **Product image** (prominent)
  - Product name
  - Quantity
  - Unit price
  - Line total
- **Order total amount** at bottom

#### Tab B: Edit Order (Locked if delivered)

**Customer Selection Section:**
- Card display showing:
  - Customer avatar image
  - Customer name
- Click to open customer search interface:
  - Search input field to filter customers
  - Results shown as customer cards with:
    - Avatar image
    - Customer name
    - City
  - Select customer card to change order customer

**Edit Items Section:**
- Product cards showing:
  - **Product image**
  - Product name
  - Quantity controls (+/- buttons)
  - Unit price
  - Line total
  - "Remove Item" button
- "Add Product" button opens product picker (reuses existing product selection UI)
- Total amount auto-calculates based on items

**Other Fields:**
- **Delivery Date**: DatePicker to modify delivery date
- **Notes**: Text field for order notes

**Action Buttons:**
- "Cancel" — discard changes
- "Save Changes" — update order + adjust customer balance

### 3. Order Delivery Confirmation

**Confirm Delivery Button:**
- Located on order card (visible before delivery)
- Shows confirmation dialog: "Mark this order as delivered? (Cannot be edited after)"
- On confirmation:
  - Sets `delivered_date` timestamp
  - Locks order from editing
  - Button changes to "Delivered" badge

## Business Logic

### Balance Adjustments
When saving an edited order:
1. Calculate new amount from edited items
2. Adjust customer balance: `new_amount - old_amount`
3. Example: Order was 1000 ILS, edited to 800 ILS → customer balance decreases by 200

### Order Locking
- Orders marked as delivered cannot be edited
- Cannot confirm delivery on already-delivered orders
- Cannot delete delivered orders

### Authorization
- Salesman can only view/edit/confirm their own orders
- Admin can view/edit all orders

## Data Model Changes

### New Fields on Transaction Model
- `delivered_date: Optional[datetime]` — timestamp when order was marked as delivered

### New Endpoints
- `PUT /orders/{order_id}` — Update order (items, customer, delivery_date, notes)
- `PUT /orders/{order_id}/deliver` — Mark order as delivered (sets delivered_date)

### Updated Endpoints
- `GET /orders/{order_id}` — Return full order with customer and product details

## Frontend Components

### New/Modified Components
- **OrderModal**: Dialog with two tabs
  - **ViewProductsTab**: Read-only product display
  - **EditOrderTab**: Editable form with customer picker, items list, delivery date, notes
- **CustomerPicker**: Searchable customer selector with avatar display
- **ProductItemCard**: Display product with image, quantity, price (editable in edit mode)

### Modified Components
- **RouteView**: Add "Confirm Delivery" button to order cards
- **UnassignedOrdersSection**: Add "Confirm Delivery" button
- Order card click handler to open modal

## Error Handling

### Edit Validations
- Order must not be delivered
- Must have at least one item
- Customer must exist
- Delivery date must be valid

### Balance Updates
- Transaction failure should rollback balance adjustments
- Log warnings if balance adjustment results in negative balance

## Testing Considerations

- Edit order with different customers, items, delivery dates
- Confirm delivery locks order
- Attempt to edit delivered order (should fail)
- Balance correctly adjusts with item changes
- Product images display correctly
- Customer search filters correctly

## Success Criteria

✅ Salesman can edit any unpaid order
✅ Order edit updates all fields (customer, items, delivery date, notes)
✅ Customer balance adjusts correctly when items change
✅ "Confirm Delivery" button marks order as delivered
✅ Delivered orders are locked from editing
✅ Product images display in all contexts
✅ Customer picker shows avatars and allows search
