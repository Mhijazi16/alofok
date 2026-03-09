import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { clearBankHistory } from "@/components/ui/bank-autocomplete";
import { decodeJwt } from "@/lib/jwt";

export type { UserRole } from "@/lib/jwt";
type UserRole = import("@/lib/jwt").UserRole;

interface AuthState {
  token: string | null;
  userId: string | null;
  role: UserRole | null;
  customerId: string | null;
}

const TOKEN_KEY = "alofok_token";

const storedToken = localStorage.getItem(TOKEN_KEY);
const decoded = storedToken ? decodeJwt(storedToken) : null;

const initialState: AuthState = {
  token: storedToken,
  userId: decoded?.sub ?? null,
  role: decoded?.role ?? null,
  customerId: decoded?.customer_id ?? null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ token: string; userId: string; role: UserRole; customerId?: string }>
    ) {
      state.token = action.payload.token;
      state.userId = action.payload.userId;
      state.role = action.payload.role;
      state.customerId = action.payload.customerId ?? null;
      localStorage.setItem(TOKEN_KEY, action.payload.token);
    },
    logout(state) {
      clearBankHistory(state.userId ?? "");
      state.token = null;
      state.userId = null;
      state.role = null;
      state.customerId = null;
      localStorage.removeItem(TOKEN_KEY);
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
