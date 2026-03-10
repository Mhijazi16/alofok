import api from "./api";
import type { Product } from "./salesApi";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomerProfile {
  id: string;
  name: string;
  city: string;
  balance: number;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
  assigned_day: string;
}

export interface CustomerTransaction {
  id: string;
  type: string;
  currency: string;
  amount: number;
  status: string | null;
  notes: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
  related_transaction_id: string | null;
  is_draft: boolean;
}

export interface CustomerStatementEntry {
  transaction: CustomerTransaction;
  running_balance: number;
}

export interface CustomerStatement {
  customer_id: string;
  entries: CustomerStatementEntry[];
  closing_balance: number;
}

export interface DraftOrderItem {
  product_id: string;
  name: string;
  image_url?: string | null;
  quantity: number;
  unit_price: number;
  selected_options?: { name: string; value: string; price: number }[] | null;
}

export interface DraftOrderCreate {
  items: DraftOrderItem[];
  notes?: string;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const customerApi = {
  login: (phone: string, password: string) =>
    api
      .post<{ access_token: string; token_type: string }>(
        "/customer-auth/login",
        { phone, password }
      )
      .then((r) => r.data),

  getProfile: () =>
    api.get<CustomerProfile>("/customer-auth/me").then((r) => r.data),

  getStatement: (
    params: {
      since_zero_balance?: boolean;
      start_date?: string;
      end_date?: string;
    } = {}
  ) =>
    api
      .get<CustomerStatement>("/customer-portal/statement", { params })
      .then((r) => r.data),

  getOrders: () =>
    api.get<CustomerTransaction[]>("/customer-portal/orders").then((r) => r.data),

  getCatalog: () =>
    api.get<Product[]>("/customer-portal/catalog").then((r) => r.data),

  createDraftOrder: (payload: DraftOrderCreate) =>
    api
      .post<CustomerTransaction>("/customer-portal/orders", payload)
      .then((r) => r.data),
};
