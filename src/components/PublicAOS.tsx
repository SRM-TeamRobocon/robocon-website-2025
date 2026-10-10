"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import AOS from "aos";

export default function PublicAOS() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    AOS.init({
      duration: 800,
      delay: 100,
      easing: "ease-out-cubic",
      once: true,
      offset: 80,
    });

    requestAnimationFrame(() => AOS.refreshHard());
  }, [pathname]);

  return null;
}
