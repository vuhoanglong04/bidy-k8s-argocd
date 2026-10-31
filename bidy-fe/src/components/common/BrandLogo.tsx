import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

export function BrandLogo({ className, priority }: BrandLogoProps) {
  return (
    <>
      <Image
        src="/logo-light@3x.webp"
        alt="Bidy"
        width={1038}
        height={554}
        priority={priority}
        className={cn("w-auto", className, "dark:hidden")}
      />
      <Image
        src="/logo-dark@3x.webp"
        alt="Bidy"
        width={1038}
        height={554}
        priority={priority}
        className={cn("w-auto", className, "hidden dark:block")}
      />
    </>
  );
}

export type { BrandLogoProps };
