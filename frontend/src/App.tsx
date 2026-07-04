import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAppSelector } from "@/store";
import { FullPageSpinner } from "@/components/ui/spinner";
import { ErrorBoundary } from "@/components/patterns/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { InstallPrompt } from "@/components/ui/install-prompt";
import { useTheme } from "@/hooks/useTheme";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import LoginPage from "@/pages/LoginPage";

const SalesRoot = lazyWithRetry(() => import("@/components/Sales"));
const DesignerRoot = lazyWithRetry(() => import("@/components/Designer"));
const AdminRoot = lazyWithRetry(() => import("@/components/Admin"));
const CustomerRoot = lazyWithRetry(() => import("@/components/Customer"));

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
        <InstallPrompt />
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
