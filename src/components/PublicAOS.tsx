"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import AOS from "aos";

export default function PublicAOS() {
  const pathname = usePathname();
  const initialized = useRef(false);

  useEffect(() => {
    if (pathname !== "/") return;

    if (!initialized.current) {
      AOS.init({
        duration: 800,
        delay: 0,
        easing: "ease-out-cubic",
        once: true,
        offset: 0,
        disableMutationObserver: true,
      });
      // AOS marks above-the-fold elements animated immediately when the page is
      // already interactive. Clear that state so the next frame can paint the
      // initial AOS styles before the animation starts.
      document.querySelectorAll("[data-aos].aos-animate").forEach((element) => {
        element.classList.remove("aos-animate");
      });
      initialized.current = true;
    }

    const frame = requestAnimationFrame(() => AOS.refreshHard());
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
