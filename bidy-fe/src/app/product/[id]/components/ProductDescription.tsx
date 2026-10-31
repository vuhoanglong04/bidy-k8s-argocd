import { AlignLeft } from "lucide-react";

interface ProductDescriptionProps {
  description: string;
}

export default function ProductDescription({ description }: ProductDescriptionProps) {
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <AlignLeft size={16} className="text-foreground-secondary" />
        <h2 className="text-xs uppercase tracking-widest font-semibold text-foreground-secondary">
          Mô tả sản phẩm
        </h2>
      </div>
      <p className="text-foreground-secondary text-base leading-relaxed whitespace-pre-line">
        {description}
      </p>
    </div>
  );
}
