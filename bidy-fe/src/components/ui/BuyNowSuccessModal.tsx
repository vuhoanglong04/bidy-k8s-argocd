"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface BuyNowSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productId: string;
  amount: number;
}

export default function BuyNowSuccessModal({
  isOpen,
  onClose,
  productName,
  productId,
  amount,
}: BuyNowSuccessModalProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  if (!isOpen) return null;

  const handleViewOtherAuctions = () => {
    setIsNavigating(true);
    router.push("/");
    onClose();
  };

  const handleGoToPayment = () => {
    setIsNavigating(true);
    const paymentUrl = `/payment?productId=${productId}&amount=${amount}&name=${encodeURIComponent(productName)}`;
    router.push(paymentUrl);
    onClose();
  };

  const handleStayOnPage = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleStayOnPage}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 animate-in fade-in-0 zoom-in-95">
        {/* Header */}
        <div className="text-center mb-6">
          {/* Success Icon */}
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-green-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            🎉 Mua nhanh thành công!
          </h2>
          
          <p className="text-gray-600">
            Bạn đã mua thành công sản phẩm <strong>&ldquo;{productName}&rdquo;</strong> với giá{" "}
            <strong className="text-green-600">
              {amount.toLocaleString("vi-VN")} VNĐ
            </strong>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Primary Action - Go to Payment */}
          <button
            onClick={handleGoToPayment}
            disabled={isNavigating}
            className="w-full bg-gradient-to-r from-yellow-400 to-yellow-100 text-primary font-bold py-3 px-4 rounded-lg transition-all hover:from-yellow-500 hover:to-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(90deg, #FFE700 0%, #FFFADF 100%)",
            }}
          >
            {isNavigating ? "Đang chuyển..." : "💳 Thanh toán ngay"}
          </button>

          {/* Secondary Action - View Other Auctions */}
          <button
            onClick={handleViewOtherAuctions}
            disabled={isNavigating}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isNavigating ? "Đang chuyển..." : "🏠 Xem các sản phẩm đấu giá khác"}
          </button>

          {/* Tertiary Action - Stay on Page */}
          <button
            onClick={handleStayOnPage}
            disabled={isNavigating}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✨ Tiếp tục xem sản phẩm này
          </button>
        </div>

        {/* Footer Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-600 text-center">
            <p className="mb-2">
              📞 <strong>Lưu ý:</strong> Quý khách vui lòng thanh toán trong vòng <strong>24 giờ</strong> sau khi mua nhanh để chính thức sở hữu sản phẩm.
            </p>
            <p>
              📧 Chúng tôi sẽ gửi email xác nhận đến bạn trong giây lát.
            </p>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={handleStayOnPage}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
          disabled={isNavigating}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}