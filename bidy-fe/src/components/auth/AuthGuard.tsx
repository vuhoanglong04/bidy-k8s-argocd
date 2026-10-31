"use client";

import { useAuth } from "@/hooks";
import { APP_ROUTES } from "@/constants";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export default function AuthGuard({ children, redirectTo = APP_ROUTES.SIGN_IN }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const redirectUrl = redirectTo === APP_ROUTES.SIGN_IN
        ? `${APP_ROUTES.SIGN_IN}?redirect=${encodeURIComponent(window.location.pathname)}`
        : redirectTo;
      router.push(redirectUrl);
    }
  }, [isAuthenticated, isLoading, redirectTo, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
