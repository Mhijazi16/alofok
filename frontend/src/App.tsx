import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAppSelector } from "@/store";
import { FullPageSpinner } from "@/components/ui/spinner";
import { ErrorBoundary } from "@/components/patterns/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { useTheme } from "@/hooks/useTheme";
import LoginPage from "@/pages/LoginPage";

const SalesRoot = lazy(() => import("@/components/Sales"));
const DesignerRoot = lazy(() => import("@/components/Designer"));
const AdminRoot = lazy(() => import("@/components/Admin"));
const CustomerRoot = lazy(() => import("@/components/Customer"));

function RoleRouter() {
  const { token, role } = useAppSelector((state) => state.auth);

  if (!token || !role) {
    return <LoginPage />;
  }

  switch (role) {
    case "Admin":
      return <AdminRoot />;
    case "Designer":
      return <DesignerRoot />;
    case "Sales":
      return <SalesRoot />;
    case "Customer":
      return <CustomerRoot />;
    default:
      return <Navigate to="/" replace />;
  }
}

export default function App() {
  useTheme(); // Initialize theme from localStorage on mount
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<FullPageSpinner />}>
          <Routes>
            <Route path="/*" element={<RoleRouter />} />
          </Routes>
        </Suspense>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
