import type { Metadata } from "next";
import { APP_ROUTES } from "@/constants/routes.constants";
import { GuideMain } from "@/components/guide";

export const metadata: Metadata = {
  title: "Hướng dẫn sử dụng",
  description:
    "Trung tâm trợ giúp và hướng dẫn chi tiết quy trình mua bán, đấu giá trên Bidy.",
  alternates: {
    canonical: APP_ROUTES.GUIDE,
  },
};

export default function GuidePage() {
  return <GuideMain />;
}
