"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/common/loading";
import { APP_ROUTES } from "@/constants/routes.constants";

interface RedirectPageProps {
  params: Promise<{
    chatId: string;
  }>;
}

export default function RedirectPage({ params }: RedirectPageProps) {
  const router = useRouter();

  useEffect(() => {
    params.then(({ chatId: resolvedChatId }) => {
      // Redirect to new query parameter format
      router.replace(APP_ROUTES.ADMIN_SUPPORT_CHAT_SELECT(resolvedChatId));
    });
  }, [router, params]);

  // Show loading while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <PageLoader message="Đang chuyển hướng..." />
    </div>
  );
}