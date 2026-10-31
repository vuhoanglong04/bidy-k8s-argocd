import type { Metadata } from "next";
import { APP_ROUTES } from "@/constants/routes.constants";
import {
  ContactHero,
  ContactChannels,
  ContactHelp,
} from "./_components";

export const metadata: Metadata = {
  title: "Liên hệ",
  description:
    "Liên hệ với đội ngũ hỗ trợ Bidy qua điện thoại, email, Messenger hoặc Zalo để được giải đáp mọi thắc mắc nhanh chóng.",
  alternates: {
    canonical: APP_ROUTES.CONTACT,
  },
};

export default function ContactPage() {
  return (
    <div className="w-full bg-background">
      <ContactHero />
      <ContactChannels />
      <ContactHelp />
    </div>
  );
}
