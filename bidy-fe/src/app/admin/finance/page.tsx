import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/constants/routes.constants";

export default function AdminFinanceRedirectPage() {
  redirect(APP_ROUTES.ADMIN_FINANCE);
}
