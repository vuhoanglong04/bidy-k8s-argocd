import { cn } from "@/lib/utils";

/**
 * Toạ độ dùng chung cho mọi animation trên hình búa (viewBox 460×420):
 * - Búa vẽ nằm ngang, xoay quanh tay cầm tại `GAVEL_PIVOT`.
 * - Mặt búa chạm bệ tại `GAVEL_IMPACT` khi xoay `GAVEL_ANGLE.strike`.
 */
export const GAVEL_PIVOT = "400 190";
export const GAVEL_IMPACT = "205 360";
export const GAVEL_ANGLE = {
  rest: 25,
  windup: 44,
  strike: -27,
  rebound: 12,
} as const;

interface GavelArtProps {
  className?: string;
}

/**
 * Búa đấu giá + bệ gõ, vẽ bằng token màu nên tự theo theme. Các phần động
 * được đánh dấu bằng `data-*` để GSAP chọn: `data-hammer`, `data-block`,
 * `data-ring`, `data-spark`.
 */
export default function GavelArt({ className }: Readonly<GavelArtProps>) {
  return (
    <svg
      viewBox="0 0 460 420"
      aria-hidden
      className={cn("overflow-visible", className)}
    >
      {/* Bệ: đế dưới */}
      <g data-block>
        <rect x="80" y="392" width="250" height="18" className="fill-foreground" />
        <ellipse cx="205" cy="410" rx="125" ry="20" className="fill-foreground" />
        <ellipse cx="205" cy="392" rx="125" ry="20" className="fill-foreground-secondary" />
        {/* Vành đỏ */}
        <rect x="102" y="378" width="206" height="10" className="fill-primary" />
        <ellipse cx="205" cy="388" rx="103" ry="17" className="fill-primary" />
        <ellipse cx="205" cy="378" rx="103" ry="17" className="fill-primary" />
        {/* Mặt gõ */}
        <rect x="122" y="360" width="166" height="16" className="fill-foreground" />
        <ellipse cx="205" cy="376" rx="83" ry="14" className="fill-foreground" />
        <ellipse cx="205" cy="360" rx="83" ry="14" className="fill-foreground-secondary" />
      </g>

      {/* Sóng va chạm, tâm ở mặt gõ */}
      {[0, 1, 2].map((i) => (
        <ellipse
          key={i}
          data-ring
          cx="205"
          cy="360"
          rx="40"
          ry="10"
          fill="none"
          strokeWidth="3"
          opacity="0"
          className="stroke-primary"
        />
      ))}

      {/* Vệt va chạm */}
      <g data-spark opacity="0">
        <rect x="150" y="300" width="6" height="30" transform="rotate(-35 153 315)" className="fill-primary" />
        <rect x="118" y="330" width="6" height="26" transform="rotate(-65 121 343)" className="fill-primary" />
        <rect x="258" y="298" width="6" height="30" transform="rotate(35 261 313)" className="fill-primary" />
      </g>

      {/* Búa, vẽ nằm ngang */}
      <g data-hammer>
        {/* Cán + chuôi */}
        <rect x="186" y="181" width="196" height="18" className="fill-foreground" />
        <rect x="372" y="174" width="44" height="32" className="fill-foreground" />
        <ellipse cx="416" cy="190" rx="6" ry="16" className="fill-foreground-secondary" />
        {/* Đầu búa hình trụ: thân + 2 đai đỏ + 2 mặt đầu */}
        <rect x="90" y="132" width="100" height="116" className="fill-foreground" />
        <rect x="84" y="132" width="112" height="20" className="fill-primary" />
        <rect x="84" y="228" width="112" height="20" className="fill-primary" />
        <ellipse cx="140" cy="132" rx="56" ry="12" className="fill-primary" />
        <ellipse cx="140" cy="248" rx="56" ry="12" className="fill-foreground" />
      </g>
    </svg>
  );
}
