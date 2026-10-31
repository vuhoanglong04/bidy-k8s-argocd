import Link from "next/link";
import {
  Phone,
  Mail,
  MessageCircle,
  MessagesSquare,
  ArrowUpRight,
  MessageSquareText,
} from "lucide-react";
import { APP_ROUTES } from "@/constants/routes.constants";

interface ContactChannelItem {
  id: string;
  label: string;
  value: string;
  href: string;
  description: string;
  icon: typeof Phone;
  external?: boolean;
}

const CONTACT_CHANNELS: ContactChannelItem[] = [
  {
    id: "phone",
    label: "Điện thoại",
    value: "0869 692 128",
    href: "tel:+84869692128",
    description: "Hỗ trợ trực tiếp qua đường dây nóng.",
    icon: Phone,
    external: false,
  },
  {
    id: "email",
    label: "Email",
    value: "support@bidy.vn",
    href: "mailto:support@bidy.vn",
    description: "Gửi thư điện tử để nhận phản hồi chi tiết.",
    icon: Mail,
    external: false,
  },
  {
    id: "messenger",
    label: "Messenger",
    value: "m.me/bidy.vietnam",
    href: "https://m.me/bidy.vietnam",
    description: "Nhắn tin qua fanpage Facebook chính thức.",
    icon: MessageCircle,
    external: true,
  },
  {
    id: "zalo",
    label: "Zalo",
    value: "zalo.me/0359219989",
    href: "https://zalo.me/0359219989",
    description: "Tư vấn và trao đổi nhanh chóng qua Zalo.",
    icon: MessagesSquare,
    external: true,
  },
];

export function ContactChannels() {
  return (
    <section
      aria-labelledby="contact-channels-title"
      className="w-full border-b border-border py-16 md:py-24"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col items-start max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            Kênh liên lạc
          </span>
          <h2
            id="contact-channels-title"
            className="font-heading text-3xl md:text-5xl font-extrabold tracking-tight uppercase leading-tight text-foreground mt-4"
          >
            Kết nối với chúng tôi
          </h2>
          <p className="text-foreground-secondary text-base md:text-lg mt-4 leading-relaxed">
            Chọn kênh liên lạc thuận tiện nhất với bạn để được hỗ trợ kịp thời.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {CONTACT_CHANNELS.map((channel) => {
            const Icon = channel.icon;
            return (
              <a
                key={channel.id}
                href={channel.href}
                target={channel.external ? "_blank" : undefined}
                rel={channel.external ? "noopener noreferrer" : undefined}
                aria-label={`${channel.label}: ${channel.value}`}
                className="group flex flex-col justify-between p-6 md:p-8 border border-border bg-card hover:border-primary transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="p-3 border border-border bg-background text-primary">
                      <Icon className="w-6 h-6" />
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
                  </div>
                  <div className="mt-6">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {channel.label}
                    </span>
                    <p className="font-heading text-xl md:text-2xl font-bold text-foreground mt-1 break-all group-hover:text-primary transition-colors">
                      {channel.value}
                    </p>
                    <p className="text-sm text-foreground-secondary mt-2 leading-relaxed">
                      {channel.description}
                    </p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {/* Khối ghi chú Chat trực tiếp */}
        <div className="mt-6 border border-border bg-card p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 border border-border bg-background text-primary shrink-0">
              <MessageSquareText className="w-6 h-6" />
            </div>
            <div>
              <p className="font-heading text-base md:text-lg font-bold text-foreground">
                Chat trực tiếp trên website
              </p>
              <p className="text-sm text-foreground-secondary mt-1">
                Biểu tượng ở góc dưới bên phải, dành cho tài khoản đã đăng nhập
              </p>
            </div>
          </div>
          <Link
            href={APP_ROUTES.SIGN_IN}
            className="h-10 px-5 font-bold uppercase text-xs tracking-widest border border-border text-foreground hover:bg-accent-subtle transition-colors inline-flex items-center justify-center shrink-0 self-start sm:self-auto"
          >
            Đăng nhập
          </Link>
        </div>
      </div>
    </section>
  );
}

export default ContactChannels;
