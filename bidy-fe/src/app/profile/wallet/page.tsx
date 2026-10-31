import { Metadata } from "next";
import { WalletView } from "./_components/WalletView";

export const metadata: Metadata = {
  title: "Ví của tôi",
  description:
    "Quản lý số dư ví Bidy, nạp tiền qua VietQR, rút tiền về tài khoản ngân hàng và theo dõi lịch sử giao dịch.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfileWalletPage() {
  return <WalletView />;
}
