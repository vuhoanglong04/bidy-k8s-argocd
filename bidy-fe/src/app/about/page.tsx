import type { Metadata } from "next";
import { APP_ROUTES } from "@/constants/routes.constants";
import {
  AboutHero,
  MissionValues,
  HowItWorks,
  Commitments,
} from "./_components";

export const metadata: Metadata = {
  title: "Về chúng tôi",
  description:
    "Bidy kết nối người mua và người bán qua một nền tảng đấu giá trực tuyến công bằng, minh bạch và cạnh tranh — nơi mỗi món đồ tìm được đúng người trân trọng nó.",
  alternates: {
    canonical: APP_ROUTES.ABOUT,
  },
};

export default function AboutPage() {
  return (
    <div className="w-full bg-background">
      <AboutHero />
      <MissionValues />
      <HowItWorks />
      <Commitments />
    </div>
  );
}
