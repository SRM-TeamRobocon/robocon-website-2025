"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import CloseFillIcon from "remixicon-react/CloseFillIcon";
import Menu3FillIcon from "remixicon-react/Menu3FillIcon";
import { useRouter } from "next/navigation";
import { useMenuContext } from "@/context/MenuContext";

export default function Header() {
  const { isMenuOpen, setMenuValue } = useMenuContext();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/admin/me", { cache: "no-store" });
        const data: { success?: boolean } = await response.json();
        setIsLoggedIn(response.ok && data.success === true);
      } catch (error) {
        console.error("Failed to check login status", error);
        setIsLoggedIn(false);
      }
    };

    void checkSession();
  }, []);

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  };

  const goToAccountPage = () => {
    router.push(isLoggedIn ? "/dashboard" : "/login");
  };

  return (
    <div>
      {/* Header section */}
      <div className="mt-12 md:mt-16 pl-10 md:pl-16 flex justify-between z-50 w-full">
        {/* Navbar Logo */}
        <Image
          src={"/textLogo.svg"}
          alt="logo"
          width={210}
          height={200}
          className="w-44 md:w-52 cursor-pointer z-50"
          onClick={() => router.push("/")}
          unoptimized
        ></Image>

        {/* Desktop NavBar */}
        <div
          className="hidden xl:flex min-w-0 flex-1 max-w-[52rem] ml-8 mr-6 items-center justify-between gap-1 pl-14 pr-6 bg-white text-[#3B3B3B] nav-bar-clip font-semibold"
        >
          <button
            className="px-2 whitespace-nowrap hover:text-red hover:scale-105"
            onClick={() => router.push("/")}
          >
            Home
          </button>
          <button
            className="px-2 whitespace-nowrap hover:text-red hover:scale-105"
            onClick={() => router.push("/team")}
          >
            Team
          </button>
          <button
            className="px-2 whitespace-nowrap hover:text-red hover:scale-105"
            onClick={() => router.push("/projects")}
          >
            Projects
          </button>
          <button
            className="px-2 whitespace-nowrap hover:text-red hover:scale-105"
            onClick={() => router.push("/achievements")}
          >
            Achievements
          </button>
          <button
            className="px-2 whitespace-nowrap hover:text-red hover:scale-105"
            onClick={() => router.push("/gallery")}
          >
            Gallery
          </button>
          <button
            className="px-2 whitespace-nowrap hover:text-red hover:scale-105"
            onClick={() => router.push("/events")}
          >
            Events
          </button>
          <button
            className="px-2 whitespace-nowrap hover:text-red hover:scale-105"
            onClick={() => router.push("/blog")}
          >
            Blog
          </button>
          <button
            className="px-2 whitespace-nowrap hover:text-red hover:scale-105"
            onClick={() => router.push("/alumni")}
          >
            Alumni
          </button>
          <button
            className="px-2 whitespace-nowrap hover:text-red hover:scale-105"
            onClick={goToAccountPage}
          >
            {isLoggedIn ? "Dashboard" : "Login"}
          </button>
          {/* <button
            className="px-3 hover:text-red hover:scale-105"
            onClick={scrollToBottom}
          >
            Contact Us
          </button> */}
        </div>

        {/* Phone NavBar */}
        <div
          className={`bg-red nav-bar-clip pl-6 pr-4 flex justify-center items-center xl:hidden z-20`}
          onClick={() => setMenuValue(!isMenuOpen)}
        >
          {isMenuOpen ? (
            <CloseFillIcon size={30} className="text-white" />
          ) : (
            <Menu3FillIcon size={30} className="text-white" />
          )}
        </div>
      </div>
      <div
        className={`${isMenuOpen ? "flex" : "hidden"
          } fixed top-0 w-screen h-full px-10 justify-center items-center z-[200] bg-black/20 backdrop-blur-sm xl:hidden`}
        onClick={() => setMenuValue(false)}
      >
        <div
          className="bg-red text-white flex flex-col justify-center items-center phone-menu-clip gap-10 p-12 z-20"
        >
          <button
            className="px-8 hover:text-black hover:scale-105"
            onClick={() => router.push("/")}
          >
            Home
          </button>
          {/* <div>

          <span className="relative flex h-3 w-3 ">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-400"></span>
            </span>
          <button
            className="px-2 hover:text-black hover:scale-105"
            onClick={() => router.push("/orientation_reg")}
          >
            Events
          </button>
          </div> */}
          <button
            className="px-8 hover:text-black hover:scale-105"
            onClick={() => router.push("/team")}
          >
            Team
          </button>
          <button
            className="px-8 hover:text-black hover:scale-105"
            onClick={() => router.push("/projects")}
          >
            Projects
          </button>
          <button
            className="px-8 hover:text-black hover:scale-105"
            onClick={() => router.push("/achievements")}
          >
            Achievements
          </button>
          <button
            className="px-8 hover:text-black hover:scale-105"
            onClick={() => router.push("/gallery")}
          >
            Gallery
          </button>
          <button
            className="px-8 hover:text-black hover:scale-105"
            onClick={() => router.push("/events")}
          >
            Events
          </button>
          <button
            className="px-8 hover:text-black hover:scale-105"
            onClick={() => router.push("/blog")}
          >
            Blog
          </button>
          <button
            className="px-8 hover:text-black hover:scale-105"
            onClick={() => router.push("/alumni")}
          >
            Alumni
          </button>
          <button
            className="px-8 hover:text-black hover:scale-105"
            onClick={goToAccountPage}
          >
            {isLoggedIn ? "Dashboard" : "Login"}
          </button>
          <button
            className="px-8 hover:text-black hover:scale-105"
            onClick={scrollToBottom}
          >
            Contact Us
          </button>
        </div>
      </div>

    </div>
  );
}
