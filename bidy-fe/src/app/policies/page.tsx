import type { Metadata } from "next";
import { APP_ROUTES } from "@/constants/routes.constants";
import { POLICY_DOCS } from "@/constants/policies.constants";
import { PolicyGroupGrid } from "./_components/PolicyGroupGrid";

export const metadata: Metadata = {
  title: "Trung tâm chính sách",
  description:
    "Tổng hợp các điều khoản dịch vụ, chính sách bảo mật và quy chế giao dịch trên Bidy.",
  alternates: {
    canonical: APP_ROUTES.POLICIES,
  },
};

export default function PoliciesPage() {
  const legalDocs = POLICY_DOCS.filter((doc) => doc.group === "legal");
  const tradeDocs = POLICY_DOCS.filter((doc) => doc.group === "trade");

  return (
    <div className="flex flex-col gap-12">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <span className="text-primary uppercase tracking-widest text-xs font-bold">
          Trung tâm chính sách
        </span>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Điều khoản & Chính sách
        </h1>
        <p className="text-foreground-secondary text-base max-w-2xl leading-relaxed">
          Tài liệu pháp lý, quy chế vận hành và các tiêu chuẩn an toàn bảo vệ quyền lợi người mua và người bán trên nền tảng đấu giá Bidy.
        </p>
      </div>

      <PolicyGroupGrid title="Pháp lý" docs={legalDocs} />
      <PolicyGroupGrid title="Giao dịch" docs={tradeDocs} />
    </div>
  );
}
