import { CalendarClock } from "lucide-react";
import ProductTitleBookmark, {
  type ProductTitleBookmarkProps,
} from "./ProductTitleBookmark";

type ProductSoonCTAProps = Pick<
  ProductTitleBookmarkProps,
  "auctionId" | "auctionOwnerId" | "currentUserId"
>;

export default function ProductSoonCTA({
  auctionId,
  auctionOwnerId,
  currentUserId,
}: ProductSoonCTAProps) {
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <CalendarClock size={16} className="text-foreground-secondary" />
        <h2 className="text-xs uppercase tracking-widest font-semibold text-foreground-secondary">
          Phiên sắp diễn ra
        </h2>
      </div>
      <ProductTitleBookmark
        variant="cta"
        auctionId={auctionId}
        auctionOwnerId={auctionOwnerId}
        currentUserId={currentUserId}
      />
    </div>
  );
}
