import { Eye, Scale, ShieldCheck, type LucideIcon } from "lucide-react";

interface MissionValueItem {
  id: string;
  number: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

const MISSION_VALUES: MissionValueItem[] = [
  {
    id: "transparency",
    number: "01",
    icon: Eye,
    title: "Minh bạch",
    description:
      "Lịch sử đặt giá công khai theo thời gian thực, ai cũng thấy cùng một mức giá.",
  },
  {
    id: "fairness",
    number: "02",
    icon: Scale,
    title: "Công bằng",
    description:
      "Luật đấu giá áp dụng như nhau cho mọi người tham gia, không ưu tiên ngầm.",
  },
  {
    id: "security",
    number: "03",
    icon: ShieldCheck,
    title: "An toàn",
    description:
      "Tài khoản được xác minh và thanh toán được bảo vệ trong suốt giao dịch.",
  },
];

export function MissionValues() {
  return (
    <section
      aria-labelledby="mission-values-title"
      className="w-full border-b border-border py-16 md:py-24"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col items-start max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            Sứ mệnh
          </span>
          <h2
            id="mission-values-title"
            className="font-heading text-3xl md:text-5xl font-extrabold tracking-tight uppercase leading-tight text-foreground mt-4"
          >
            Trao quyền cho mọi người qua đấu giá công bằng.
          </h2>
          <p className="text-foreground-secondary text-base md:text-lg mt-4 leading-relaxed">
            Chúng tôi tạo ra trải nghiệm đấu giá nhanh chóng, công bằng và dễ
            tiếp cận cho cá nhân lẫn doanh nghiệp tại Việt Nam.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border mt-12">
          {MISSION_VALUES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="bg-card p-8 flex flex-col justify-between gap-8"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-primary tracking-widest">
                    {item.number}
                  </span>
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading text-xl font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm text-foreground-secondary leading-relaxed mt-2">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default MissionValues;
