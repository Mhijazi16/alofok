# Order Editing Feature - Fixes Needed

**Date**: 2026-03-03
**Status**: Implementation complete, UX/data model fixes needed

## Issues Identified

### Issue 1: Confirm Delivery Button Location
**Problem:** "Confirm Delivery" button is inside the OrderModal dialog. Should be on the order card itself for easier access.

**Current:** Button in modal footer
**Expected:** Button on order card (like a small badge/button next to order details)

**Files to modify:**
- `frontend/src/components/Sales/RouteView.tsx` - Add "Confirm Delivery" button to order cards
- `frontend/src/components/Sales/OrderModal.tsx` - Remove "Confirm Delivery" from modal footer

**Implementation:**
- Move `confirmOrderDelivery` logic from OrderModal to order card click handler
- Add button/badge on order card showing delivery status
- OrderModal footer should only have: Cancel (when editing) / Save Changes (when editing)

---

### Issue 2: Customer Avatar Not Showing in Modal
**Problem:** In the OrderModal's Edit tab, the CustomerPicker shows customer card but avatar doesn't display for the selected customer.

**Current:** CustomerPicker displays selected customer but avatar is missing
**Expected:** Customer avatar should be visible in the picker

**Root cause:** The customer data fetched from `getMyCustomers` may not include `avatar_url`, or the fallback to seed-based avatar isn't working.

**Files to check:**
- `frontend/src/services/salesApi.ts` - Check Customer interface includes avatar_url
- `frontend/src/components/ui/customer-picker.tsx` - Verify Avatar component gets proper data

**Implementation:**
- Verify Customer type has `avatar_url: string | null`
- In CustomerPicker, ensure Avatar receives either the avatar_url or uses name as fallback for seed

---

### Issue 3: Avatar Data Not Persisted in Updates
**Problem:** Backend doesn't store customer/user avatar seeds, and when updating customer or user, the request body doesn't include avatar data.

**Current:**
- Avatar URLs stored but seed not persisted
- Update endpoints don't handle avatar changes

**Expected:**
- Avatar seed or URL should be updatable via API
- When changing customer in order edit, should preserve their avatar

**Files to modify:**
- `backend/app/schemas/customer.py` - Ensure CustomerUpdate includes avatar_url
- `backend/app/schemas/customer_auth.py` - User avatar field if applicable
- `frontend/src/services/salesApi.ts` - CustomerUpdate payload should include avatar_url when available

**Implementation:**
1. Verify schemas allow avatar_url in update payloads
2. Update frontend OrderModal to send avatar_url in update payload (if available)
3. Backend should accept and store avatar_url in update operations

---

## Testing Checklist

- [ ] Create order and click it - modal opens
- [ ] Edit customer - avatar shows in picker
- [ ] Edit customer - avatar persists in database
- [ ] Edit delivery date and items
- [ ] Save changes
- [ ] Confirm delivery from order card (not modal)
- [ ] Order is locked after delivery confirmation
- [ ] Unassigned orders can be edited/confirmed

---

## Files Affected

**Backend:**
- `app/schemas/customer.py` - Add avatar_url to CustomerUpdate
- `app/services/customer_service.py` - Handle avatar in update_customer

**Frontend:**
- `src/components/Sales/RouteView.tsx` - Add Confirm Delivery button to cards
- `src/components/Sales/OrderModal.tsx` - Remove Confirm Delivery from modal, fix Avatar display
- `src/components/ui/customer-picker.tsx` - Fix Avatar display in selected customer

---

## Git Status
Current branch: `feat/frontend-overhaul`
All 11 implementation tasks committed successfully.

Ready for fixes in new session.
