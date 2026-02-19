import api from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name_ar: string;
  name_en: string;
  sku: string;
  price: number;
  image_url: string | null;
  is_discounted: boolean;
  is_bestseller: boolean;
}

export interface Customer {
  id: string;
  name: string;
  city: string;
  assigned_day: string;
  balance: number;
}

export interface CustomerInsights {
  total_debt: number;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  avg_payment_interval_days: number | null;
  risk_score: "green" | "yellow" | "red";
}

export interface Transaction {
  id: string;
  type: string;
  currency: string;
  amount: number;
  status: string | null;
  notes: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
  related_transaction_id: string | null;
}

export interface StatementEntry {
  transaction: Transaction;
  running_balance: number;
}

export interface Statement {
  customer_id: string;
  entries: StatementEntry[];
  closing_balance: number;
}

export interface OrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface OrderCreate {
  customer_id: string;
  items: OrderItem[];
  notes?: string;
}

export interface PaymentCreate {
  customer_id: string;
  type: "Payment_Cash" | "Payment_Check";
  currency: "ILS" | "USD" | "JOD";
  amount: number;
  notes?: string;
  data?: {
    bank?: string;
    due_date?: string;
    image_url?: string;
  };
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const salesApi = {
  login: (username: string, password: string) =>
    api
      .post<{ access_token: string; token_type: string }>("/auth/login", {
        username,
        password,
      })
      .then((r) => r.data),

  getProducts: () =>
    api.get<Product[]>("/products").then((r) => r.data),

  getMyRoute: () =>
    api.get<Customer[]>("/customers/my-route").then((r) => r.data),

  getInsights: (customerId: string) =>
    api
      .get<CustomerInsights>(`/customers/${customerId}/insights`)
      .then((r) => r.data),

  getStatement: (
    customerId: string,
    params: {
      since_zero_balance?: boolean;
      start_date?: string;
      end_date?: string;
    } = {}
  ) =>
    api
      .get<Statement>(`/customers/${customerId}/statement`, { params })
      .then((r) => r.data),

  createOrder: (payload: OrderCreate) =>
    api.post<Transaction>("/orders", payload).then((r) => r.data),

  createPayment: (payload: PaymentCreate) =>
    api.post<Transaction>("/payments", payload).then((r) => r.data),

  returnCheck: (checkId: string) =>
    api
      .put<Transaction>(`/payments/checks/${checkId}/status`, {
        status: "Returned",
      })
      .then((r) => r.data),
};
