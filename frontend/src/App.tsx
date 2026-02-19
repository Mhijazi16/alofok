import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAppSelector } from "@/store";
import LoginPage from "@/pages/LoginPage";

// Role-specific root components (populated as features are built)
import AdminRoot from "@/components/Admin";
import DesignerRoot from "@/components/Designer";
import SalesRoot from "@/components/Sales";

function RoleRouter() {
  const role = useAppSelector((s) => s.auth.role);
  const token = useAppSelector((s) => s.auth.token);

  if (!token || !role) {
    return <LoginPage />;
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
