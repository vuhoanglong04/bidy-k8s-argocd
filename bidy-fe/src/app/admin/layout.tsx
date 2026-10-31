"use client";

import React from "react";
import { NotificationProvider } from '@/contexts/NotificationContext';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotificationProvider>
      <section className="bg-background min-h-screen">{children}</section>
    </NotificationProvider>
  );
}
