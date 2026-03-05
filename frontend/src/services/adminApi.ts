import api from "./api";
import type { Customer, CustomerCreate, CheckData } from "./salesApi";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RepConfirmation {
  handed_over_amount: number;
  confirmed_at: string | null;
  confirmer_name: string | null;
  is_flagged: boolean;
  flag_notes: string | null;
}

export interface RepCashSummary {
  rep_id: string;
  rep_name: string;
  cash_total: number;
  check_total: number;
  expense_total: number;
  computed_net: number;
  payment_count: number;
  expense_count: number;
  confirmation: RepConfirmation | null;
}

export interface DailyCashReport {
  report_date: string;
  grand_cash: number;
  grand_checks: number;
  grand_expenses: number;
  grand_net: number;
  reps: RepCashSummary[];
}

export interface ConfirmHandoverPayload {
  rep_id: string;
  report_date: string;
  handed_over_amount: number;
}

export interface FlagHandoverPayload {
  rep_id: string;
  report_date: string;
  handed_over_amount: number;
  flag_notes: string;
}

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

export interface CheckOut {
  id: string;
  customer_id: string;
  customer_name: string;
  type: string;
  currency: string;
  amount: number;
  status: string | null;
  notes: string | null;
  data: CheckData | null;
  created_at: string;
  related_transaction_id: string | null;
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

  archiveCustomer: (id: string) =>
    api.patch(`/admin/customers/${id}/archive`).then((r) => r.data),

  getChecks: (status?: "Pending" | "Deposited" | "Returned") =>
    api
      .get<CheckOut[]>("/admin/checks", { params: status ? { status } : {} })
      .then((r) => r.data),

  depositCheck: (checkId: string) =>
    api.put<CheckOut>(`/payments/checks/${checkId}/deposit`).then((r) => r.data),

  undepositCheck: (checkId: string) =>
    api.put<CheckOut>(`/payments/checks/${checkId}/undeposit`).then((r) => r.data),

  returnCheck: (checkId: string, notes?: string) =>
    api
      .put<CheckOut>(`/payments/checks/${checkId}/return`, { notes: notes || null })
      .then((r) => r.data),

  getDailyCashReport: (reportDate: string) =>
    api
      .get<DailyCashReport>("/admin/cash-report", { params: { report_date: reportDate } })
      .then((r) => r.data),

  confirmHandover: (payload: ConfirmHandoverPayload) =>
    api.post("/admin/cash-report/confirm", payload).then((r) => r.data),

  flagHandover: (payload: FlagHandoverPayload) =>
    api.post("/admin/cash-report/flag", payload).then((r) => r.data),
};
