import Image from "next/image";
import { Trophy } from "lucide-react";
import { STATUS_AUCTIONS } from "@/constants/app.enum";

export interface Bid {
  id: number;
  name: string;
  avatar: string;
  time: string;
  amount: number;
}

interface ProductBidListProps {
  bids: Bid[];
  formatCurrency: (amount: number) => string;
  type: STATUS_AUCTIONS;
}

export default function ProductBidList({ bids, formatCurrency, type }: Readonly<ProductBidListProps>) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Trophy size={16} className="text-foreground-secondary" />
        <h2 className="text-xs uppercase tracking-widest font-semibold text-foreground-secondary">
          Kết quả đấu giá
        </h2>
      </div>

      <div className="flex flex-col border border-border bg-background divide-y divide-border max-h-[320px] overflow-y-auto">
        {bids.slice(0, 3).map((bid, idx) => (
          <div key={bid.id} className="flex items-center gap-3 p-3">
            <Image
              src={bid.avatar}
              alt={bid.name}
              width={40}
              height={40}
              className="rounded-full object-cover w-10 h-10"
            />
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm truncate">
                  {bid.name}
                </span>
                {type === STATUS_AUCTIONS.ENDED && idx === 0 && (
                  <span className="bg-success text-success-foreground text-xs px-1.5 py-0.5 font-medium flex-shrink-0">
                    Người thắng
                  </span>
                )}
              </div>
              {bid.time && (
                <span className="text-xs text-foreground-secondary">{bid.time}</span>
              )}
            </div>
            <span
              className={`text-sm font-bold text-right ${
                idx === 0 ? "text-primary" : "text-foreground"
              }`}
            >
              {formatCurrency(bid.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
