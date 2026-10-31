// import React from "react";
import { useRouter } from "next/navigation";
import { Bid } from "@/types";
import { APP_ROUTES } from "@/constants/routes.constants";
import { UnifiedAuctionCard } from "@/components/auction";

interface ProductCardProps {
  product: Bid;
  tab?: string;
  buyerTab?: string;
  layout?: "horizontal" | "vertical";
  handleProductClick: (product: Bid) => void;
  handleButtonClick?: (
    e: React.MouseEvent,
    product: Bid,
    action: string
  ) => void;
}
const ProductCard: React.FC<ProductCardProps> = ({
  product,
  layout = "horizontal",
  handleProductClick,
}) => {
  const router = useRouter();

  // Transform Bid to UnifiedAuctionItem format
  const transformedItem = {
    id: product._id || '',
    _id: product._id,
    name: product.name || 'Sản phẩm không tên',
    image: product.image,
    price: product.price,
    startingPrice: product.price,
    priceBuyNow: product.priceBuyNow,
    time_remain: product.time_remain,
    endDate: product.endDate,
    finishedTime: product.finishedTime,
    owner: product.owner,
    top_ownerships: product.top_ownerships,
    status: product.status,
  };

  const handleAction = (action: string, item: { _id?: string }) => {
    if (action === 'edit') {
      if (product.productId) {
        router.push(APP_ROUTES.PRODUCT_EDIT(product.productId));
      } else {
        router.push(APP_ROUTES.MY_PRODUCTS);
      }
    } else if (action === 'delete') {
      // Handle delete action
      console.log('Delete action for item:', item._id);
    }
  };

  return (
    <div onClick={() => handleProductClick(product)}>
      <UnifiedAuctionCard 
        item={transformedItem}
        layout={layout}
        context="profile"
        showActions={true}
        onAction={handleAction}
      />
    </div>
  );
};
export default ProductCard;
