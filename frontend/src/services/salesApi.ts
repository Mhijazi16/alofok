import api from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar?: string | null;
  description_en?: string | null;
  sku: string;
  price: number;
  discount_percentage?: number | null;
  discounted_price?: number | null;
  image_url: string | null;
  is_discounted: boolean;
  is_bestseller: boolean;
  category?: string | null;
  brand?: string | null;
  stock_qty?: number | null;
  unit?: string;
  weight?: number | null;
  color_options?: string[] | null;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  city: string;
  address?: string | null;
  assigned_day: string;
  balance: number;
  latitude?: number | null;
  longitude?: number | null;
  avatar_url?: string | null;
  notes?: string | null;
}

export interface CustomerCreate {
  name: string;
  phone?: string | null;
  city: string;
  address?: string | null;
  assigned_day: string;
  latitude?: number | null;
  longitude?: number | null;
  avatar_url?: string | null;
  notes?: string | null;
}

export interface CustomerUpdate {
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
  assigned_day?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  avatar_url?: string | null;
  notes?: string | null;
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

  createCustomer: (body: CustomerCreate) =>
    api.post<Customer>("/customers", body).then((r) => r.data),

  updateCustomer: (id: string, body: CustomerUpdate) =>
    api.put<Customer>(`/customers/${id}`, body).then((r) => r.data),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ url: string }>("/customers/upload-avatar", form)
      .then((r) => r.data);
  },
};
