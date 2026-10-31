import React from "react";
import Image from "next/image";
import Link from "next/link";
import { APP_ROUTES } from "@/constants/routes.constants";

export default function Hero() {
  return (
    <section className="relative w-full min-h-[90vh] bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.1),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(245,158,11,0.1),transparent_50%)]" />

      <div className="relative max-w-7xl mx-auto px-4 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left Content */}
          <div className="space-y-8 text-center lg:text-left">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                <span className="block">Đấu Giá</span>
                <span className="block bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent">
                  Trực Tuyến
                </span>
                <span className="block text-3xl md:text-4xl lg:text-5xl text-gray-700">
                  Bidy
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Khám phá thế giới đấu giá trực tuyến với hàng ngàn sản phẩm độc đáo.
                <span className="block mt-2 font-medium text-gray-800">
                  Tham gia ngay và trở thành người thắng cuộc!
                </span>
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href={APP_ROUTES.CATEGORY}
                className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold text-lg rounded-xl hover:from-orange-600 hover:to-amber-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                🎯 Bắt Đầu Đấu Giá
              </Link>

              <Link
                href={APP_ROUTES.ABOUT}
                className="inline-flex items-center justify-center px-8 py-4 bg-white/80 backdrop-blur-sm text-gray-800 font-semibold text-lg rounded-xl border-2 border-orange-200 hover:bg-white hover:border-orange-300 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                📖 Tìm Hiểu Thêm
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-orange-200/50">
              <div className="text-center lg:text-left">
                <div className="text-2xl md:text-3xl font-bold text-orange-600">1000+</div>
                <div className="text-sm text-gray-600 font-medium">Sản phẩm</div>
              </div>
              <div className="text-center lg:text-left">
                <div className="text-2xl md:text-3xl font-bold text-amber-600">500+</div>
                <div className="text-sm text-gray-600 font-medium">Người dùng</div>
              </div>
              <div className="text-center lg:text-left">
                <div className="text-2xl md:text-3xl font-bold text-yellow-600">24/7</div>
                <div className="text-sm text-gray-600 font-medium">Hỗ trợ</div>
              </div>
            </div>
          </div>

          {/* Right Content - Hero Image */}
          <div className="relative">
            <div className="relative w-full h-[500px] lg:h-[600px]">
              {/* Background decoration for image */}
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-200/30 to-amber-200/30 rounded-3xl transform rotate-3 scale-105" />
              <div className="absolute inset-0 bg-gradient-to-bl from-yellow-200/20 to-orange-200/20 rounded-3xl transform -rotate-2 scale-95" />

              {/* Main hero image */}
              <div className="relative w-full h-full bg-white rounded-2xl shadow-2xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
                <Image
                  src="/Gemini_Generated_Image_n64pwen64pwen64p.png"
                  alt="Bidy Auction Platform - Cute animals participating in online auctions"
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                />

                {/* Overlay with floating elements */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />

                {/* Floating auction badges */}
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg">
                  <span className="text-sm font-bold text-orange-600">🔥 HOT!</span>
                </div>

                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg">
                  <span className="text-sm font-bold text-green-600">✨ Live Auction</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave decoration */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" className="w-full h-auto">
          <path
            d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}
