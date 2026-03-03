import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type UserRole = "Admin" | "Designer" | "Sales" | "Customer";

interface AuthState {
  token: string | null;
  userId: string | null;
  role: UserRole | null;
  customerId: string | null;
}

const TOKEN_KEY = "alofok_token";

function decodeJwt(token: string): { sub: string; role: UserRole; customer_id?: string } | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64));
    return {
      sub: payload.sub,
      role: payload.role as UserRole,
      customer_id: payload.customer_id,
    };
  } catch {
    return null;
  }
}

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
