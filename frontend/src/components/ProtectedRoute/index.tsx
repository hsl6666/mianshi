import { Navigate, useLocation } from "react-router-dom";
import { ROUTE_PATHS } from "@/constants/common";
import { useAuthStore } from "@/store/authStore";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to={ROUTE_PATHS.login} replace state={{ from: location.pathname }} />;
  }

  return children;
}
