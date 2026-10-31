import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";
import { ArrowRight, ChevronRight, HelpCircle } from "lucide-react";
import { APP_ROUTES } from "@/constants/routes.constants";
import { getPolicyBySlug, POLICY_DOCS } from "@/constants/policies.constants";
import { formatPolicyDate } from "@/app/policies/_components/formatPolicyDate";

interface PolicyDetailPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return POLICY_DOCS.map((doc) => ({
    slug: doc.slug,
  }));
}

export async function generateMetadata({
  params,
}: PolicyDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getPolicyBySlug(slug);

  if (!doc) {
    return {
      title: "Không tìm thấy chính sách",
    };
  }

  return {
    title: doc.title,
    description: doc.summary,
    alternates: {
      canonical: APP_ROUTES.POLICY(slug),
    },
  };
}

export default async function PolicyDetailPage({
  params,
}: PolicyDetailPageProps) {
  const { slug } = await params;
  const doc = getPolicyBySlug(slug);

  if (!doc) {
    notFound();
  }

  return (
    <article className="flex flex-col gap-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <Link
          href={APP_ROUTES.POLICIES}
          className="hover:text-primary transition-colors"
        >
          Chính sách
        </Link>
        <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="text-foreground truncate">{doc.title}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          {doc.title}
        </h1>
        <p className="text-sm font-mono text-muted-foreground">
          Cập nhật lần cuối: {formatPolicyDate(doc.updatedAt)}
        </p>
      </div>

      {/* Draft notice banner */}
      <div role="note" className="border border-warning bg-warning/10 text-foreground p-4 text-sm flex items-center gap-3">
        <p>Nội dung đang được soạn thảo và sẽ được cập nhật chính thức.</p>
      </div>

      {/* Table of contents */}
      <div className="border border-border p-6 bg-card flex flex-col gap-4">
        <h2 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
          Mục lục
        </h2>
        <ol className="flex flex-col gap-2 list-none p-0 m-0">
          {doc.sections.map((section, idx) => {
            const num = (idx + 1).toString().padStart(2, "0");
            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex items-center gap-3 text-sm text-foreground-secondary hover:text-primary transition-colors group"
                >
                  <span className="font-mono text-xs text-primary font-bold">
                    {num}
                  </span>
                  <span className="group-hover:underline">{section.heading}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Policy Sections */}
      <div className="flex flex-col gap-10">
        {doc.sections.map((section, idx) => {
          const num = (idx + 1).toString().padStart(2, "0");
          return (
            <section
              key={section.id}
              id={section.id}
              className="border-t border-border pt-8 scroll-mt-24 flex flex-col gap-4"
            >
              <h2 className="font-heading text-xl font-bold text-foreground flex items-baseline gap-3">
                <span className="font-mono text-base text-primary font-bold">
                  {num}
                </span>
                <span>{section.heading}</span>
              </h2>
              <div className="flex flex-col gap-3">
                {section.paragraphs.map((p, pIdx) => (
                  <p
                    key={pIdx}
                    className="text-foreground-secondary leading-relaxed text-sm sm:text-base"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Help / Contact Section */}
      <div className="border-t border-border pt-10 mt-6">
        <div className="border border-border p-6 bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm text-foreground">
                Còn thắc mắc về điều khoản này?
              </h3>
              <p className="text-xs text-foreground-secondary mt-1">
                Đội ngũ hỗ trợ của Bidy luôn sẵn sàng giải đáp các câu hỏi của bạn.
              </p>
            </div>
          </div>
          <Link
            href={APP_ROUTES.CONTACT}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors shrink-0"
          >
            <span>Liên hệ hỗ trợ</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
