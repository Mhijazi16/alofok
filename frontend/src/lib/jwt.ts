/**
 * JWT decode utility.
 * Single source of truth — used by authSlice and LoginPage.
 */

export type UserRole = "Admin" | "Designer" | "Sales" | "Customer";

export function decodeJwt(
  token: string
): { sub: string; role: UserRole; customer_id?: string } | null {
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
