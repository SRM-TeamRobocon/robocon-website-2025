"use client";

import Image from "next/image";
import Link from "next/link";
import CloseFillIcon from "remixicon-react/CloseFillIcon";
import Menu3FillIcon from "remixicon-react/Menu3FillIcon";
import { useMenuContext } from "@/context/MenuContext";

const links = [
  ["/", "Home"],
  ["/team", "Team"],
  ["/projects", "Projects"],
  ["/achievements", "Achievements"],
  ["/gallery", "Gallery"],
  ["/events", "Events"],
  ["/blog", "Blog"],
  ["/alumni", "Alumni"],
  ["/login", "Login"],
];

export default function Header({ animate = false }: { animate?: boolean }) {
  const { isMenuOpen, setMenuValue } = useMenuContext();

  return (
    <header>
      <div className="mt-12 md:mt-16 pl-10 md:pl-16 flex justify-between z-50 w-full">
        <Link href="/" aria-label="SRM Team Robocon home" className="w-44 md:w-52 shrink-0 z-50">
          <Image src="/textLogo.svg" alt="SRM Team Robocon" width={210} height={200} className="w-full" unoptimized />
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden xl:flex min-w-0 flex-1 max-w-[52rem] ml-8 mr-6 items-center justify-between gap-1 pl-14 pr-6 bg-white text-[#3B3B3B] nav-bar-clip font-semibold"
          data-aos={animate ? "slide-left" : undefined}
        >
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="px-2 whitespace-nowrap hover:text-red motion-safe:hover:scale-105">
              {label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
          className="bg-red nav-bar-clip pl-6 pr-4 flex justify-center items-center xl:hidden z-20"
          data-aos={animate ? "slide-left" : undefined}
          onClick={() => setMenuValue(!isMenuOpen)}
        >
          {isMenuOpen ? (
            <CloseFillIcon size={30} className="text-white" aria-hidden="true" />
          ) : (
            <Menu3FillIcon size={30} className="text-white" aria-hidden="true" />
          )}
        </button>
      </div>
      <div
        className={`${isMenuOpen ? "flex" : "hidden"} fixed inset-0 w-screen h-full px-10 justify-center items-center z-[200] bg-black/20 backdrop-blur-sm xl:hidden`}
        role="presentation"
        onClick={() => setMenuValue(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setMenuValue(false);
        }}
      >
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="bg-red text-white flex flex-col items-center phone-menu-clip gap-6 p-12 z-20 max-h-[100dvh] overflow-y-auto"
        >
          {links.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setMenuValue(false)} className="px-8 hover:text-black motion-safe:hover:scale-105">
              {label}
            </Link>
          ))}
          <a href="#contact" className="px-8 hover:text-black motion-safe:hover:scale-105">Contact Us</a>
          <button type="button" onClick={() => setMenuValue(false)} className="px-8 hover:text-black">Close menu</button>
        </nav>
      </div>
    </header>
  );
}
