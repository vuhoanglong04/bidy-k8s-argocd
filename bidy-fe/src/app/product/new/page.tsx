"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  useCreateProduct,
  useProductDetail,
  usePublishProduct,
  useUpdateProductInfo,
  useUploadProductImages,
  type StoredProductImage,
} from "@/services/product";
import { useActiveCategories } from "@/services/category";
import { APP_ROUTES } from "@/constants/routes.constants";
import { PageLoader } from "@/components/common/loading";
import { PRODUCT_CONDITION } from "@/constants/app.enum";

import StepProductImages from "./_components/StepProductImages";
import StepProductInfo from "./_components/StepProductInfo";
import StepPublish from "./_components/StepPublish";
import WizardStepper, { type WizardStep } from "@/components/common/WizardStepper";
import type { ProductInfoForm } from "./schema";

/**
 * Ba bước, và ranh giới bước là ranh giới commit chứ không phải chia cho đẹp:
 * ảnh cần `productId` mới upload được, nên bước 1 buộc phải tạo draft trước.
 * Làm một trang thì phải giữ ảnh trong memory rồi upload sau, upload hỏng là
 * product đã tồn tại còn ảnh mất.
 */
const STEPS: readonly WizardStep[] = [
  { id: 1, title: "Thông tin", hint: "Tên, danh mục, tình trạng" },
  { id: 2, title: "Hình ảnh", hint: "Tối đa 10 ảnh" },
  { id: 3, title: "Đăng bán", hint: "Xem lại rồi đăng" },
];

function ProductWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { categories } = useActiveCategories();

  // `?edit=<id>` mở lại một sản phẩm đã có thay vì tạo mới. Dùng chính wizard
  // này để sửa nên không phải dựng form thứ hai, và người sửa vẫn đi qua bước
  // ảnh — thứ mà dialog sửa không làm được.
  const editingId = searchParams.get("edit");

  const [currentStep, setCurrentStep] = useState(1);
  const [productId, setProductId] = useState<string | null>(null);
  const [info, setInfo] = useState<ProductInfoForm | null>(null);
  const [images, setImages] = useState<StoredProductImage[]>([]);

  const createProduct = useCreateProduct();
  const updateInfo = useUpdateProductInfo();
  const uploadImages = useUploadProductImages();
  const publishProduct = usePublishProduct();

  const existing = useProductDetail(editingId);

  // Nạp sản phẩm đang sửa vào state một lần, sau đó wizard chạy y như bình thường.
  useEffect(() => {
    const product = existing.data;
    if (!product?.id) return;

    setProductId(product.id);
    setInfo({
      name: product.name ?? "",
      categoryId: product.categoryId ?? "",
      condition: (product.condition as PRODUCT_CONDITION) ?? PRODUCT_CONDITION.USED,
      description: product.description ?? "",
    });
    setImages(product.images ?? []);
  }, [existing.data]);

  const isDraftCreated = Boolean(productId);
  const isEditing = Boolean(editingId);
  const isPublished = existing.data?.status === "active";

  const handleSubmitInfo = useCallback(
    (values: ProductInfoForm) => {
      // Đã có product rồi thì đây là sửa, không phải tạo. Trước đây nhánh này
      // chỉ đổi state local nên thay đổi không bao giờ tới server.
      if (isDraftCreated && productId) {
        updateInfo.mutate(
          {
            productId,
            body: {
              name: values.name,
              categoryId: values.categoryId,
              condition: values.condition,
              description: values.description?.trim() ?? "",
            },
          },
          {
            onSuccess: () => {
              setInfo(values);
              setCurrentStep(2);
              toast.success("Đã lưu thay đổi");
            },
          }
        );
        return;
      }

      createProduct.mutate(
        {
          name: values.name,
          categoryId: values.categoryId,
          condition: values.condition,
          ...(values.description?.trim()
            ? { description: values.description.trim() }
            : {}),
        },
        {
          onSuccess: (created) => {
            // Không có id thì bước 2 không có chỗ gắn ảnh — dừng ngay còn hơn
            // để user upload vào hư không.
            if (!created?.id) {
              toast.error("Không nhận được mã sản phẩm từ máy chủ. Thử lại giúp mình.");
              return;
            }

            setProductId(created.id);
            setInfo(values);
            setCurrentStep(2);
            toast.success("Đã lưu bản nháp");
          },
        }
      );
    },
    [createProduct, isDraftCreated, productId, updateInfo]
  );

  const handleUploadImages = useCallback(
    (files: File[]) => {
      if (!productId) return;

      uploadImages.mutate(
        { productId, files },
        {
          onSuccess: (uploaded) => {
            // Response chỉ trả các row VỪA tạo, không phải toàn bộ ảnh của
            // product — nên nối vào chứ không ghi đè.
            setImages((previous) => [...previous, ...(uploaded ?? [])]);
            toast.success(`Đã tải lên ${files.length} ảnh`);
          },
        }
      );
    },
    [productId, uploadImages]
  );

  const handlePublish = useCallback(() => {
    if (!productId) return;

    publishProduct.mutate(productId, {
      onSuccess: () => {
        toast.success("Sản phẩm đã được đăng bán");
        // Nối thẳng sang luồng đấu giá với sản phẩm vừa đăng chọn sẵn.
        router.push(`${APP_ROUTES.AUCTION_NEW}?product=${productId}`);
      },
    });
  }, [productId, publishProduct, router]);

  // Thay đổi đã được lưu ở từng bước rồi, nút này chỉ là lối thoát. Vào từ
  // "Sửa" thì trả về đúng danh sách kho hàng chứ không đá ra trang tổng quan.
  const handleExit = useCallback(() => {
    toast.success(
      isEditing
        ? "Đã lưu thay đổi."
        : "Đã lưu bản nháp. Bạn có thể quay lại hoàn thiện sau."
    );
    router.push(isEditing ? APP_ROUTES.MY_PRODUCTS : APP_ROUTES.PROFILE);
  }, [isEditing, router]);

  const categoryName = useMemo(
    () => categories.find((category) => category.id === info?.categoryId)?.name,
    [categories, info?.categoryId]
  );

  // Stepper là điều hướng, không phải cổng gác: sau khi có draft thì cho nhảy
  // tự do giữa các bước, chỉ chặn khi chưa có gì để nhảy tới.
  const isStepReachable = useCallback(
    (step: number) => step === 1 || isDraftCreated,
    [isDraftCreated]
  );

  // Chờ nạp xong mới dựng form, không thì bước 1 render rỗng rồi mới nhảy số.
  if (isEditing && existing.isPending) {
    return <PageLoader message="Đang tải sản phẩm…" />;
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-secondary">
          Kho hàng
        </p>
        <h1 className="mt-2 text-3xl font-bold text-foreground lg:text-4xl">
          {isEditing ? "Sửa sản phẩm" : "Đăng sản phẩm"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground-secondary">
          {isEditing
            ? "Sửa thông tin, thêm hoặc bớt ảnh. Thay đổi được lưu ngay ở từng bước."
            : "Thêm món hàng vào kho của bạn. Sau khi đăng bán, bạn có thể mở phiên đấu giá cho nó bất cứ lúc nào — và mở lại nhiều lần nếu chưa bán được."}
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-12">
        <aside className="lg:w-64 lg:shrink-0">
          <WizardStepper
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={
              isDraftCreated
                ? [
                    1,
                    ...(images.length > 0 ? [2] : []),
                    ...(isPublished ? [3] : []),
                  ]
                : []
            }
            isStepReachable={isStepReachable}
            onStepChange={setCurrentStep}
          />
        </aside>

        <div className="min-w-0 flex-1 lg:max-w-2xl">
          {currentStep === 1 && (
            <StepProductInfo
              defaultValues={info ?? undefined}
              isSaved={isDraftCreated}
              isSubmitting={createProduct.isPending || updateInfo.isPending}
              onSubmit={handleSubmitInfo}
            />
          )}

          {currentStep === 2 && (
            <StepProductImages
              uploadedImages={images}
              isUploading={uploadImages.isPending}
              onUpload={handleUploadImages}
              onBack={() => setCurrentStep(1)}
              onContinue={() => setCurrentStep(3)}
            />
          )}

          {currentStep === 3 && info && (
            <StepPublish
              info={info}
              categoryName={categoryName}
              imageCount={images.length}
              isPublished={isPublished}
              isPublishing={publishProduct.isPending}
              onBack={() => setCurrentStep(2)}
              isEditing={isEditing}
              onSaveDraft={handleExit}
              onPublish={handlePublish}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<PageLoader message="Đang tải…" />}>
      <ProductWizard />
    </Suspense>
  );
}
