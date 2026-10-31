import Link from "next/link";
import { APP_ROUTES } from "@/constants/routes.constants";

interface BreadcrumbsProps {
  productName: string;
}

export default function Breadcrumbs({ productName }: BreadcrumbsProps) {
  return (
    <nav className="mb-6">
      <ol className="flex items-center space-x-2 text-sm text-foreground-secondary">
        <li>
          <Link href={APP_ROUTES.HOME} className="hover:text-primary">
            Trang chủ
          </Link>
        </li>
        <li>/</li>
        <li>
          <Link href={APP_ROUTES.CATEGORY} className="hover:text-primary">
            Danh mục
          </Link>
        </li>
        <li>/</li>
        <li className="text-foreground font-medium">{productName}</li>
      </ol>
    </nav>
  );
} 