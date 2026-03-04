---
phase: quick-fix
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/schemas/transaction.py
autonomous: true
requirements: [BUGFIX-order-data-serialization]

must_haves:
  truths:
    - "Order transactions return data.items array when fetched via API"
    - "Check payment transactions still validate CheckData fields on creation"
    - "Statement views display check data correctly for payment transactions"
  artifacts:
    - path: "backend/app/schemas/transaction.py"
      provides: "TransactionOut with dict | None data field"
      contains: "data: dict | None"
  key_links:
    - from: "TransactionOut.data"
      to: "Transaction.data JSONB column"
      via: "Pydantic from_attributes serialization"
      pattern: "data: dict \\| None"
---

<objective>
Fix order card click showing no products by changing TransactionOut.data type from CheckData to dict.

Purpose: TransactionOut.data typed as CheckData causes Pydantic to silently discard order item data (which is a plain dict with an "items" key, not CheckData). Changing to dict | None allows both order data and check data to serialize correctly.

Output: Single line fix in backend schema file.
</objective>

<execution_context>
@/home/ka1ser/.claude/get-shit-done/workflows/execute-plan.md
@/home/ka1ser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/app/schemas/transaction.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix TransactionOut.data type from CheckData to dict</name>
  <files>backend/app/schemas/transaction.py</files>
  <action>
On line 28 of backend/app/schemas/transaction.py, change:
  data: CheckData | None
to:
  data: dict | None

This is the ONLY change needed. Do NOT modify:
- CheckData class definition (still needed for PaymentCreate validation)
- PaymentCreate.data type (must remain CheckData | None for input validation)
- Any other field on TransactionOut

The reason: TransactionOut is the OUTPUT schema used to serialize all transaction types (orders, payments, etc.). Orders store {"items": [...]} in the JSONB data column, which is not a CheckData shape. Pydantic fails to parse it as CheckData and returns None, hiding the order items from the frontend.
  </action>
  <verify>
    <automated>cd /home/ka1ser/projects/alofok/backend && python -c "
from app.schemas.transaction import TransactionOut, PaymentCreate, CheckData
import inspect

# Verify TransactionOut.data is dict | None (not CheckData)
hints = TransactionOut.__annotations__
assert 'data' in hints, 'data field missing'
data_hint = str(hints['data'])
assert 'CheckData' not in data_hint, f'TransactionOut.data still uses CheckData: {data_hint}'
assert 'dict' in data_hint, f'TransactionOut.data should be dict | None: {data_hint}'

# Verify PaymentCreate.data still uses CheckData
pay_hints = PaymentCreate.__annotations__
assert 'CheckData' in str(pay_hints.get('data', '')), 'PaymentCreate.data should still use CheckData'

# Verify order data serializes correctly
t = TransactionOut(
    id='00000000-0000-0000-0000-000000000001',
    customer_id='00000000-0000-0000-0000-000000000002',
    type='Order',
    currency='ILS',
    amount=100,
    status=None,
    notes=None,
    data={'items': [{'product_id': 'abc', 'quantity': 2}]},
    created_at='2026-01-01T00:00:00',
    related_transaction_id=None,
)
assert t.data is not None, 'data should not be None for orders'
assert 'items' in t.data, 'data.items should be present'
print('ALL CHECKS PASSED')
"
    </automated>
  </verify>
  <done>TransactionOut.data is typed as dict | None. Order items serialize correctly. PaymentCreate still validates CheckData on input.</done>
</task>

</tasks>

<verification>
- Python verification script confirms TransactionOut serializes order data with items
- PaymentCreate still uses CheckData for check payment input validation
</verification>

<success_criteria>
- Fetching an order via API returns data.items array (not null)
- Creating a check payment still validates CheckData fields
- No other schema changes needed
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-order-card-click-showing-no-products/1-SUMMARY.md`
</output>
