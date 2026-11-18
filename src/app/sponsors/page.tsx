import { publicPageMetadata } from "@/lib/seo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SponsorsClientView from "@/components/sponsors/SponsorsClientView";
import { SPONSORS_DATA, SPONSOR_TIERS, PARTNER_BENEFITS } from "@/data/sponsors";

export const metadata = publicPageMetadata("/sponsors");
export const revalidate = 60;

export default function SponsorsPage() {
  return (
    <div className="overflow-x-hidden bg-black text-white">
      <Header />
      <main id="main-content">
        <SponsorsClientView
          sponsors={SPONSORS_DATA}
          tiers={SPONSOR_TIERS}
          benefits={PARTNER_BENEFITS}
        />
      </main>
      <Footer />
    </div>
  );
}
