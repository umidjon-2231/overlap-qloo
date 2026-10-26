"use client";

import { useEffect, useRef } from "react";

/** The screen-print pull loop (rendered in Blender: brand/blender/screenprint_loop.py). Paused under reduced motion. */
export function PressLoop({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) v.pause();
    else void v.play().catch(() => {});
  }, []);
  return (
    <video ref={ref} className={`aspect-[8/5] w-full ${className}`} muted loop playsInline preload="auto" poster="/motion/screenprint-poster.webp" aria-hidden="true">
      <source src="/motion/screenprint-loop.webm" type="video/webm" />
      <source src="/motion/screenprint-loop.mp4" type="video/mp4" />
    </video>
  );
}
