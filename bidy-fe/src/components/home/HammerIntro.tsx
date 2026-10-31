"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Observer } from "gsap/Observer";
import { useGSAP } from "@gsap/react";
import { ChevronDown } from "lucide-react";

import GavelArt, { GAVEL_ANGLE, GAVEL_PIVOT } from "./GavelArt";
import { createStrikeTimeline, resetGavel } from "./gavelMotion";

gsap.registerPlugin(Observer, useGSAP);

const STORAGE_KEY = "bidy:home-intro-seen";

/**
 * Chạy trước khi React hydrate: khách đã xem intro (hoặc bật giảm chuyển động)
 * được gắn `data-intro-seen` lên <html> để overlay bị ẩn ngay từ HTML server,
 * không nháy lên rồi mới tắt.
 */
const PRE_HYDRATION_SCRIPT = `try{if(localStorage.getItem("${STORAGE_KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.introSeen="1"}catch(e){}`;

const hasSeenIntro = () => {
  try {
    return (
      localStorage.getItem(STORAGE_KEY) !== null ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return true;
  }
};

const markIntroSeen = () => {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Không lưu được thì lần sau xem lại intro — chấp nhận được.
  }
};

interface HammerIntroProps {
  /** Gọi khi intro kết thúc hoặc được bỏ qua (kể cả khi không cần chạy). */
  onDone: () => void;
}

type Step = "idle" | "sold" | "leaving" | "done";

/**
 * Intro trang chủ, chỉ chạy ở lần vào đầu tiên. Không bám theo vị trí cuộn:
 * mỗi cú cuộn/vuốt/phím kích hoạt trọn một hành động.
 *   Cuộn 1 → búa gõ, chữ SOLD đóng dấu ở nền.
 *   Cuộn 2 → búa bay về đúng chỗ của nó trong hero, overlay tan đi.
 * Trong lúc intro chạy, trang bị khoá cuộn.
 */
export default function HammerIntro({ onDone }: Readonly<HammerIntroProps>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("idle");
  const stepRef = useRef<Step>("idle");
  const busyRef = useRef(false);
  const idleRef = useRef<gsap.core.Tween | null>(null);
  const releaseInputRef = useRef<() => void>(() => {});

  const goTo = useCallback((next: Step) => {
    stepRef.current = next;
    setStep(next);
  }, []);

  const finish = useCallback(() => {
    // Component vẫn mount (chỉ render null) nên phải tự gỡ Observer, nếu không
    // nó tiếp tục preventDefault và trang không cuộn được.
    releaseInputRef.current();
    markIntroSeen();
    document.documentElement.style.overflow = "";
    goTo("done");
    onDone();
  }, [goTo, onDone]);

  const leave = useCallback(() => {
    const root = rootRef.current;
    const art = artRef.current;
    const target = document.querySelector<HTMLElement>("[data-landing-gavel]");
    if (!root || !art || !target) {
      finish();
      return;
    }

    busyRef.current = true;
    idleRef.current?.kill();
    goTo("leaving");
    window.scrollTo(0, 0);

    const from = art.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const q = gsap.utils.selector(root);

    gsap
      .timeline({ defaults: { ease: "power3.inOut" }, onComplete: finish })
      .to(q("[data-hint], [data-skip]"), { opacity: 0, duration: 0.25 }, 0)
      .to(q("[data-sold]"), { opacity: 0, scale: 1.15, letterSpacing: "0.12em", duration: 0.6 }, 0)
      .to(q("[data-hammer]"), { rotation: GAVEL_ANGLE.rest, svgOrigin: GAVEL_PIVOT, duration: 0.5 }, 0)
      .to(
        art,
        {
          x: to.left - from.left,
          y: to.top - from.top,
          scale: to.width / from.width,
          transformOrigin: "0 0",
          duration: 1.1,
        },
        0.1
      )
      .to(q("[data-backdrop]"), { opacity: 0, duration: 0.8, ease: "power2.inOut" }, 0.35);
  }, [finish, goTo]);

  const strike = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    busyRef.current = true;
    idleRef.current?.kill();
    const q = gsap.utils.selector(root);

    createStrikeTimeline(artRef.current, {
      onComplete: () => {
        busyRef.current = false;
      },
    })
      .to(q("[data-flash]"), { opacity: 1, duration: 0.04 }, "impact")
      .to(q("[data-flash]"), { opacity: 0, duration: 0.4 }, "impact+=0.04")
      .to(
        q("[data-shake]"),
        { keyframes: { x: [0, -12, 10, -7, 4, 0], y: [0, 7, -5, 3, 0] }, duration: 0.35 },
        "impact"
      )
      .fromTo(
        q("[data-sold]"),
        { opacity: 0, scale: 1.6 },
        { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2.2)", immediateRender: false },
        "impact"
      );
    goTo("sold");
  }, [goTo]);

  const advance = useCallback(() => {
    if (busyRef.current) return;
    if (stepRef.current === "idle") strike();
    else if (stepRef.current === "sold") leave();
  }, [leave, strike]);

  // Khách đã xem rồi → báo xong ngay, không khoá cuộn.
  useEffect(() => {
    if (hasSeenIntro()) {
      goTo("done");
      onDone();
      return;
    }
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [goTo, onDone]);

  useGSAP(
    () => {
      if (stepRef.current !== "idle" || hasSeenIntro()) return;

      resetGavel(artRef.current);
      idleRef.current = gsap.to(artRef.current?.querySelectorAll("[data-hammer]") ?? [], {
        rotation: GAVEL_ANGLE.rest + 7,
        svgOrigin: GAVEL_PIVOT,
        duration: 1.1,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      const observer = Observer.create({
        target: window,
        type: "wheel,touch",
        tolerance: 12,
        preventDefault: true,
        onChangeY: advance,
      });

      const onKey = (event: KeyboardEvent) => {
        if (["ArrowDown", "PageDown", " ", "Enter"].includes(event.key)) {
          event.preventDefault();
          advance();
        }
      };
      window.addEventListener("keydown", onKey);

      const release = () => {
        observer.kill();
        window.removeEventListener("keydown", onKey);
      };
      releaseInputRef.current = release;
      return release;
    },
    { scope: rootRef, dependencies: [] }
  );

  if (step === "done") return null;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_HYDRATION_SCRIPT }} />
      <div
        ref={rootRef}
        role="dialog"
        aria-label="Giới thiệu Bidy"
        className="fixed inset-0 z-[60] in-data-intro-seen:hidden"
      >
        <div data-backdrop className="absolute inset-0 bg-background" />

        <div data-shake className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <span
            data-sold
            aria-hidden
            className="absolute select-none font-heading text-[30vw] font-black leading-none tracking-tighter text-primary/15 opacity-0 md:text-[24vw]"
          >
            SOLD
          </span>
          <div data-flash aria-hidden className="absolute inset-0 bg-primary/10 opacity-0" />

          <div ref={artRef} className="relative aspect-[460/420] h-[min(58vh,420px)]">
            <GavelArt className="absolute inset-0 size-full" />
          </div>
        </div>

        <button
          type="button"
          data-skip
          onClick={() => !busyRef.current && leave()}
          className="absolute right-4 top-4 cursor-pointer border border-border bg-card/70 px-4 py-2 text-sm font-medium text-foreground backdrop-blur-md transition-colors hover:border-primary hover:text-primary"
        >
          Bỏ qua
        </button>

        <button
          type="button"
          data-hint
          onClick={advance}
          className="absolute bottom-10 left-1/2 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-foreground-secondary"
        >
          {step === "idle" ? "Cuộn để gõ búa" : "Cuộn để vào sàn"}
          <ChevronDown className="size-5 animate-bounce" aria-hidden />
        </button>
      </div>
    </>
  );
}
