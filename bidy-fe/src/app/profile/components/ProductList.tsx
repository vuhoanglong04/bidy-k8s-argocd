import React from "react";
import ProductCard from "./ProductCard";
import { secureRandom } from "@/utils";
import { Bid } from "@/types";

interface ProductListProps {
  products: Bid[];
  view: string;
  tab: string;
  buyerTab: string;
  handleProductClick: (product: Bid) => void;
  handleButtonClick: (
    e: React.MouseEvent,
    product: Bid,
    action: string
  ) => void;
}

const ProductList: React.FC<ProductListProps> = ({
  products,
  view,
  tab,
  buyerTab,
  handleProductClick,
  handleButtonClick,
}) => {
  if (products?.length === 0) {
    return (
      <div className="border border-dashed border-border px-6 py-16 text-center">
        <p className="text-base font-medium text-foreground">
          Chưa có sản phẩm nào ở mục này
        </p>
        <p className="mt-1 text-sm text-foreground-secondary">
          Sản phẩm khớp với bộ lọc hiện tại sẽ hiện ở đây.
        </p>
      </div>
    );
  }
  
  // Force list view on mobile, allow grid view only on larger screens
  const effectiveView = view;
  
  return effectiveView === "list" ? (
    <div className="flex flex-col gap-4">
      {products &&
        products?.map((product) => (
          <ProductCard
            key={secureRandom()}
            product={product}
            tab={tab}
            buyerTab={buyerTab}
            handleProductClick={handleProductClick}
            handleButtonClick={handleButtonClick}
          />
        ))}
    </div>
  ) : (
    <>
      {/* Mobile: Always show list view */}
      <div className="flex flex-col gap-4 md:hidden">
        {products &&
          products?.map((product) => (
            <ProductCard
              key={secureRandom()}
              product={product}
              tab={tab}
              buyerTab={buyerTab}
              handleProductClick={handleProductClick}
              handleButtonClick={handleButtonClick}
            />
          ))}
      </div>
      {/* Desktop: Show grid view when selected */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products &&
          products?.map((product) => (
            <ProductCard
              key={secureRandom()}
              product={product}
              tab={tab}
              buyerTab={buyerTab}
              layout="vertical"
              handleProductClick={handleProductClick}
              handleButtonClick={handleButtonClick}
            />
          ))}
      </div>
    </>
  );
};

export default ProductList;
