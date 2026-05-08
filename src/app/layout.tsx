import "./globals.css";
import type { Metadata } from "next";
import { Aldrich } from "next/font/google";
const aldrich = Aldrich({ weight: "400", subsets: ["latin"] });
import "aos/dist/aos.css";
import MenuContextProvider from "@/context/MenuContextProvider";
import ParticlesCom from "@/components/Particles";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";

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
    <html lang="en" className="!scroll-smooth bg-black">
      <body className={aldrich.className}>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />
        <MenuContextProvider>
          <ParticlesCom />
          {children}
          <Analytics />
        </MenuContextProvider>
      </body>
    </html>
  );
}
