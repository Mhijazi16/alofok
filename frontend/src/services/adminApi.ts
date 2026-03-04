import api from "./api";
import type { Customer, CustomerCreate } from "./salesApi";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SalesRepStats {
  user_id: string;
  username: string;
  total_orders: number;
  order_count: number;
  total_collected: number;
  collection_count: number;
}

export interface SalesStatsOut {
  period_start: string;
  period_end: string;
  reps: SalesRepStats[];
  grand_total_orders: number;
  grand_total_collected: number;
}

export interface CityDebt {
  city: string;
  total_debt: number;
  customer_count: number;
}

export interface OverdueCheck {
  transaction_id: string;
  customer_name: string;
  amount: number;
  currency: string;
  bank: string | null;
  due_date: string | null;
}

export interface DebtStatsOut {
  total_debt: number;
  by_city: CityDebt[];
  overdue_checks: OverdueCheck[];
}

export interface SalesRep {
  id: string;
  username: string;
}

export interface AdminCustomerCreate extends CustomerCreate {
  assigned_to: string;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const adminApi = {
  getSalesStats: (startDate: string, endDate: string) =>
    api
      .get<SalesStatsOut>("/admin/stats/sales", {
        params: { start_date: startDate, end_date: endDate },
      })
      .then((r) => r.data),

  getDebtStats: () =>
    api.get<DebtStatsOut>("/admin/stats/debt").then((r) => r.data),

  sendEodReport: (reportDate?: string) =>
    api
      .post<{ date: string; rows: number }>("/admin/reports/eod", null, {
        params: reportDate ? { report_date: reportDate } : {},
      })
      .then((r) => r.data),

  importCustomers: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ created: number; errors: string[] }>(
        "/admin/customers/import",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      .then((r) => r.data);
  },

  getAllCustomers: () =>
    api.get<Customer[]>("/admin/customers").then((r) => r.data),

  createCustomer: (body: AdminCustomerCreate) =>
    api.post<Customer>("/admin/customers", body).then((r) => r.data),

  getSalesReps: () =>
    api.get<SalesRep[]>("/admin/users/sales-reps").then((r) => r.data),

  updateCustomer: (id: string, body: Partial<AdminCustomerCreate>) =>
    api.put<Customer>(`/admin/customers/${id}`, body).then((r) => r.data),
};
