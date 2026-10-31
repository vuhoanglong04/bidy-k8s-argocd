import React from "react";
import { PolicyNav } from "./_components/PolicyNav";

export default function PoliciesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full bg-background min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Sidebar */}
          <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-border pb-8 lg:pb-0 lg:pr-6 lg:sticky lg:top-24">
            <PolicyNav />
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-9 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
