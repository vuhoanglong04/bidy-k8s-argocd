"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import WizardStepper, { type WizardStep } from "@/components/common/WizardStepper";
import { PageLoader } from "@/components/common/loading";
import { getNumericValue } from "@/components/ui/MoneyInput";
import { APP_ROUTES } from "@/constants/routes.constants";
import { MAX_AUCTION_PRICE } from "@/constants";
import { useCreateAuctionRequest } from "@/services/auction-request";
import { useMyProducts } from "@/services/product";

import StepAuctionConfig from "./_components/StepAuctionConfig";
import StepAuctionReview from "./_components/StepAuctionReview";
import StepAuctionSchedule from "./_components/StepAuctionSchedule";
import type { AuctionConfigState, AuctionScheduleState } from "./types";

const STEPS: readonly WizardStep[] = [
  { id: 1, title: "Cấu hình", hint: "Sản phẩm, số lượng, giá" },
  { id: 2, title: "Thời gian", hint: "Bắt đầu và kết thúc" },
  { id: 3, title: "Gửi yêu cầu", hint: "Xem lại và gửi duyệt" },
];

function NewAuctionWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Đến thẳng từ luồng đăng sản phẩm: product vừa publish được chọn sẵn.
  const preselectedProductId = searchParams.get("product") ?? "";

  const [currentStep, setCurrentStep] = useState(1);
  // Bước chỉ được tick khi đã qua validate; sửa lại dữ liệu của bước đó thì bỏ tick.
  const [passedSteps, setPassedSteps] = useState<number[]>([]);
  const [config, setConfig] = useState<AuctionConfigState>({
    productId: preselectedProductId,
    quantity: "1",
    startingPrice: "",
    buyNowPrice: "",
    bidIncrement: "",
  });
  const [schedule, setSchedule] = useState<AuctionScheduleState>({
    startMode: "now",
    startDate: null,
    endDate: null,
  });
  const [configErrors, setConfigErrors] = useState<
    Partial<Record<keyof AuctionConfigState, string>>
  >({});
  const [scheduleErrors, setScheduleErrors] = useState<
    Partial<Record<keyof AuctionScheduleState, string>>
  >({});

  // Picker cần thấy hết kho; mặc định của backend chỉ 20 item.
  const myProducts = useMyProducts({ limit: 100 });
  const createAuctionRequest = useCreateAuctionRequest();

  const products = useMemo(() => myProducts.data?.items ?? [], [myProducts.data]);
  const selectedProduct = products.find((product) => product.id === config.productId);

  const startingPrice = getNumericValue(config.startingPrice);
  const buyNowPrice = config.buyNowPrice ? getNumericValue(config.buyNowPrice) : undefined;
  // Bỏ trống là hợp lệ: backend có mặc định riêng, gửi 0 lên sẽ bị từ chối.
  const bidIncrement = config.bidIncrement
    ? getNumericValue(config.bidIncrement)
    : undefined;
  const quantity = Number(config.quantity);

  const handleChangeConfig = useCallback((patch: Partial<AuctionConfigState>) => {
    setConfig((previous) => ({ ...previous, ...patch }));
    setConfigErrors({});
    setPassedSteps((previous) => previous.filter((step) => step !== 1));
  }, []);

  const handleChangeSchedule = useCallback((patch: Partial<AuctionScheduleState>) => {
    setSchedule((previous) => ({ ...previous, ...patch }));
    setScheduleErrors({});
    setPassedSteps((previous) => previous.filter((step) => step !== 2));
  }, []);

  // Validate khi bấm thay vì disable nút câm — nút xám không nói lý do thì user
  // không biết thiếu gì.
  const handleContinueFromConfig = useCallback(() => {
    const errors: Partial<Record<keyof AuctionConfigState, string>> = {};

    if (!config.productId) errors.productId = "Vui lòng chọn sản phẩm";
    if (!Number.isInteger(quantity) || quantity < 1) {
      errors.quantity = "Số lượng phải là số nguyên từ 1 trở lên";
    }
    if (!startingPrice || startingPrice <= 0) {
      errors.startingPrice = "Vui lòng nhập giá khởi điểm";
    } else if (startingPrice > MAX_AUCTION_PRICE) {
      errors.startingPrice = `Giá khởi điểm không được vượt quá ${Math.floor(MAX_AUCTION_PRICE).toLocaleString("vi-VN")} VNĐ`;
    }
    if (buyNowPrice !== undefined) {
      if (buyNowPrice <= startingPrice) {
        errors.buyNowPrice = "Giá mua ngay phải cao hơn giá khởi điểm";
      } else if (buyNowPrice > MAX_AUCTION_PRICE) {
        errors.buyNowPrice = `Giá mua ngay không được vượt quá ${Math.floor(MAX_AUCTION_PRICE).toLocaleString("vi-VN")} VNĐ`;
      }
    }
    if (bidIncrement !== undefined) {
      if (bidIncrement <= 0) {
        errors.bidIncrement = "Bước giá phải lớn hơn 0";
      } else if (bidIncrement > MAX_AUCTION_PRICE) {
        errors.bidIncrement = `Bước giá không được vượt quá ${Math.floor(MAX_AUCTION_PRICE).toLocaleString("vi-VN")} VNĐ`;
      }
    }

    setConfigErrors(errors);
    if (Object.keys(errors).length === 0) {
      setPassedSteps((previous) => (previous.includes(1) ? previous : [...previous, 1]));
      setCurrentStep(2);
    }
  }, [bidIncrement, buyNowPrice, config.productId, quantity, startingPrice]);

  const handleContinueFromSchedule = useCallback(() => {
    const errors: Partial<Record<keyof AuctionScheduleState, string>> = {};
    const now = new Date();

    if (schedule.startMode === "scheduled") {
      if (!schedule.startDate) {
        errors.startDate = "Vui lòng chọn thời điểm bắt đầu";
      } else if (schedule.startDate.getTime() <= now.getTime()) {
        errors.startDate = "Thời điểm bắt đầu phải ở tương lai";
      }
    }

    const effectiveStart =
      schedule.startMode === "now" ? now : schedule.startDate ?? now;

    if (!schedule.endDate) {
      errors.endDate = "Vui lòng chọn thời điểm kết thúc";
    } else if (schedule.endDate.getTime() <= effectiveStart.getTime()) {
      errors.endDate = "Thời điểm kết thúc phải sau lúc bắt đầu";
    }

    setScheduleErrors(errors);
    if (Object.keys(errors).length === 0) {
      setPassedSteps((previous) => (previous.includes(2) ? previous : [...previous, 2]));
      setCurrentStep(3);
    }
  }, [schedule]);

  const handleSubmit = useCallback(() => {
    if (!schedule.endDate) return;

    // "Đăng luôn" tính mốc ngay lúc bấm, cộng đệm nhỏ để không rơi vào quá khứ
    // trên đường truyền.
    const startDate =
      schedule.startMode === "now"
        ? new Date(Date.now() + 30 * 1000)
        : schedule.startDate;

    if (!startDate) return;

    createAuctionRequest.mutate(
      {
        productId: config.productId,
        quantity,
        startingPrice,
        ...(buyNowPrice !== undefined ? { buyNowPrice } : {}),
        ...(bidIncrement !== undefined ? { bidIncrement } : {}),
        startDate: startDate.toISOString(),
        endDate: schedule.endDate.toISOString(),
      },
      {
        onSuccess: () => {
          toast.success("Đã gửi yêu cầu đăng phiên đấu giá. Vui lòng chờ quản trị viên phê duyệt.");
          router.push(APP_ROUTES.MY_AUCTION_REQUESTS);
        },
      }
    );
  }, [
    bidIncrement,
    buyNowPrice,
    config.productId,
    createAuctionRequest,
    quantity,
    router,
    schedule,
    startingPrice,
  ]);

  const isStepReachable = useCallback(
    (step: number) => step === 1 || Boolean(config.productId),
    [config.productId]
  );

  const effectiveStartDate =
    schedule.startMode === "now" ? new Date() : schedule.startDate;

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-secondary">
          Yêu cầu đăng phiên
        </p>
        <h1 className="mt-2 text-3xl font-bold text-foreground lg:text-4xl">
          Yêu cầu đăng phiên đấu giá
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground-secondary">
          Gửi yêu cầu mở phiên cho món hàng đã có trong kho để ban quản trị duyệt trước khi lên sàn. Cùng một sản phẩm có thể đấu giá lại nhiều lần nếu lần trước chưa bán được.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-12">
        <aside className="lg:w-64 lg:shrink-0">
          <WizardStepper
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={passedSteps}
            isStepReachable={isStepReachable}
            onStepChange={setCurrentStep}
          />
        </aside>

        <div className="min-w-0 flex-1 lg:max-w-2xl">
          {currentStep === 1 && (
            <StepAuctionConfig
              products={products}
              isLoadingProducts={myProducts.isPending}
              isProductsError={myProducts.isError}
              onRetryProducts={() => myProducts.refetch()}
              value={config}
              errors={configErrors}
              onChange={handleChangeConfig}
              onContinue={handleContinueFromConfig}
            />
          )}

          {currentStep === 2 && (
            <StepAuctionSchedule
              value={schedule}
              errors={scheduleErrors}
              onChange={handleChangeSchedule}
              onBack={() => setCurrentStep(1)}
              onContinue={handleContinueFromSchedule}
            />
          )}

          {currentStep === 3 && effectiveStartDate && schedule.endDate && (
            <StepAuctionReview
              product={selectedProduct}
              quantity={quantity}
              startingPrice={startingPrice}
              buyNowPrice={buyNowPrice}
              bidIncrement={bidIncrement}
              startDate={effectiveStartDate}
              endDate={schedule.endDate}
              isStartingNow={schedule.startMode === "now"}
              isSubmitting={createAuctionRequest.isPending}
              onBack={() => setCurrentStep(2)}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default function NewAuctionPage() {
  return (
    <Suspense fallback={<PageLoader message="Đang tải…" />}>
      <NewAuctionWizard />
    </Suspense>
  );
}
