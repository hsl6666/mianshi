import { Navigate } from "react-router-dom";
import { ROUTE_PATHS } from "@/constants/common";
import { useAuthStore } from "@/store/authStore";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  if (!isSuperAdmin) {
    return <Navigate to={ROUTE_PATHS.biddingProjects} replace />;
  }

  return children;
}
