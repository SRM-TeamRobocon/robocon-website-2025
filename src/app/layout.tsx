import "./globals.css";
import type { Metadata } from "next";
import { Aldrich, Geist } from "next/font/google";
const aldrich = Aldrich({ weight: "400", subsets: ["latin"] });
import "aos/dist/aos.css";
import MenuContextProvider from "@/context/MenuContextProvider";
import ConditionalParticles from "@/components/ConditionalParticles";
import { Analytics } from "@vercel/analytics/react";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "srmteamrobocon",
  description: "Robotics Reimagined",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("!scroll-smooth bg-black", "font-sans", geist.variable)}>
      <body className={aldrich.className}>
        <MenuContextProvider>
          <ConditionalParticles />
          <div className="relative z-10">
            {children}
          </div>
          <Analytics />
        </MenuContextProvider>
      </body>
    </html>
  );
}
