import gsap from "gsap";

import { GAVEL_ANGLE, GAVEL_IMPACT, GAVEL_PIVOT } from "./GavelArt";

type Scope = Element | null;

const pick = (scope: Scope, selector: string) =>
  scope ? Array.from(scope.querySelectorAll(selector)) : [];

/** Đặt búa về tư thế chờ và ẩn các hiệu ứng va chạm. */
export function resetGavel(scope: Scope) {
  gsap.set(pick(scope, "[data-hammer]"), { rotation: GAVEL_ANGLE.rest, svgOrigin: GAVEL_PIVOT });
  gsap.set(pick(scope, "[data-ring]"), { opacity: 0, scale: 0.2, transformOrigin: "50% 50%" });
  gsap.set(pick(scope, "[data-spark]"), { opacity: 0, scale: 0.6, transformOrigin: "50% 100%" });
  gsap.set(pick(scope, "[data-block]"), { scaleY: 1, svgOrigin: "205 420" });
}

/**
 * Một nhịp gõ trọn vẹn: lấy đà → gõ → va chạm (sóng, vệt, bệ lún) → nảy về
 * tư thế chờ. Mốc `"impact"` trên timeline trả về để nơi gọi gắn thêm hiệu
 * ứng riêng (rung khung, chữ SOLD…).
 */
export function createStrikeTimeline(scope: Scope, vars: gsap.TimelineVars = {}) {
  const hammer = pick(scope, "[data-hammer]");
  const rings = pick(scope, "[data-ring]");
  const spark = pick(scope, "[data-spark]");
  const block = pick(scope, "[data-block]");

  return gsap
    .timeline(vars)
    .to(hammer, { rotation: GAVEL_ANGLE.windup, duration: 0.35, ease: "power2.out", svgOrigin: GAVEL_PIVOT })
    .to(hammer, { rotation: GAVEL_ANGLE.strike, duration: 0.14, ease: "power4.in", svgOrigin: GAVEL_PIVOT })
    .addLabel("impact")
    .fromTo(
      rings,
      { opacity: 0.9, scale: 0.2 },
      { opacity: 0, scale: 3, duration: 0.6, stagger: 0.08, ease: "power2.out", immediateRender: false },
      "impact"
    )
    .fromTo(
      spark,
      { opacity: 1, scale: 0.6 },
      { opacity: 0, scale: 1.25, duration: 0.45, ease: "power2.out", immediateRender: false },
      "impact"
    )
    .to(block, { scaleY: 0.9, duration: 0.05, svgOrigin: "205 420" }, "impact")
    .to(block, { scaleY: 1, duration: 0.4, ease: "elastic.out(1, 0.4)" }, "impact+=0.05")
    .to(hammer, { rotation: GAVEL_ANGLE.rebound, duration: 0.22, ease: "power2.out" }, "impact")
    .to(hammer, { rotation: GAVEL_ANGLE.rest, duration: 0.5, ease: "power1.inOut" }, ">");
}

export { GAVEL_IMPACT };
