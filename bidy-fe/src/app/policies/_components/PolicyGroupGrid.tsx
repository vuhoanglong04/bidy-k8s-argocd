import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { APP_ROUTES } from "@/constants/routes.constants";
import { PolicyDoc } from "@/constants/policies.constants";
import { formatPolicyDate } from "./formatPolicyDate";

interface PolicyGroupGridProps {
  title: string;
  docs: PolicyDoc[];
}

export function PolicyGroupGrid({ title, docs }: PolicyGroupGridProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border-b border-border pb-2">
        <h2 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
        {docs.map((doc) => (
          <Link
            key={doc.slug}
            href={APP_ROUTES.POLICY(doc.slug)}
            className="bg-card p-6 flex flex-col justify-between gap-6 hover:bg-accent-subtle transition-colors group"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-heading text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  {doc.title}
                </h3>
                <ArrowUpRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
              </div>
              <p className="text-sm text-foreground-secondary leading-relaxed">
                {doc.summary}
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              Cập nhật {formatPolicyDate(doc.updatedAt)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
