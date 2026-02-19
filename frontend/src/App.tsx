import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAppSelector } from "@/store";

// Role-specific root components (populated as features are built)
import AdminRoot from "@/components/Admin";
import DesignerRoot from "@/components/Designer";
import SalesRoot from "@/components/Sales";

function RoleRouter() {
  const role = useAppSelector((s) => s.auth.role);
  const token = useAppSelector((s) => s.auth.token);

  if (!token || !role) {
    // TODO: replace with <LoginPage /> when F-004 is built
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Login coming soon…</p>
      </div>
    );
  }

  if (role === "Admin") return <AdminRoot />;
  if (role === "Designer") return <DesignerRoot />;
  return <SalesRoot />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<RoleRouter />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
