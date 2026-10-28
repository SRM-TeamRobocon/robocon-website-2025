import "./globals.css";
import type { Metadata } from "next";
import { Aldrich, Geist } from "next/font/google";
const aldrich = Aldrich({ weight: "400", subsets: ["latin"] });
import "aos/dist/aos.css";
import Script from "next/script";
import MenuContextProvider from "@/context/MenuContextProvider";
import ConditionalParticles from "@/components/ConditionalParticles";
import PublicAOS from "@/components/PublicAOS";
import { Analytics } from "@vercel/analytics/react";
import { cn } from "@/lib/utils";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, SOCIAL_IMAGE } from "@/lib/seo";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Public pages explicitly opt in; account and operational routes stay out of search.
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION, images: [SOCIAL_IMAGE] },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("!scroll-smooth bg-black", "font-sans", geist.variable)}>
      <body className={aldrich.className}>
        {/* Vercel already 307s the bare apex to www at the edge, but that only fires on a
            real top-level navigation. A tab that's been client-side-routing (Next.js Link/
            router.push) since before that redirect ran, or one restored from bfcache, keeps
            showing apex in the URL bar - and every fetch() from an apex-origin page silently
            drops cookies on the auto-followed redirect to www (default `credentials:
            "same-origin"` only attaches cookies when the request's final origin matches the
            page's own origin), so any logged-in action 401s and looks like a random logout.
            Runs before hydration so it wins the race against the page's own fetch calls. */}
        <Script id="canonical-host-redirect" strategy="beforeInteractive">
          {`(function(){try{if(window.location.hostname==='srmteamrobocon.com'){window.location.replace(window.location.href.replace('://srmteamrobocon.com','://www.srmteamrobocon.com'));}}catch(e){}})();`}
        </Script>
        <MenuContextProvider>
          <ConditionalParticles />
          <PublicAOS />
          <div className="relative z-10">
            {children}
          </div>
          <Analytics />
        </MenuContextProvider>
      </body>
    </html>
  );
}
