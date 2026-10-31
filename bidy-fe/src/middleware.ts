import { withAuth } from "@/middlewares/auth.middleware";
import { NextResponse } from "next/server";

const middleware = withAuth(async () => {
  return NextResponse.next();
});

export default middleware;

export const config = {
  // Guard phải chạy trên MỌI trang, không chỉ route protected: admin lạc sang
  // `/` hay `/signin` cũng phải bị kéo về `/admin`. Loại trừ asset, api và file
  // tĩnh để không tốn middleware cho chúng.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
