import { publicPageMetadata } from "@/lib/seo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SponsorsClientView from "@/components/sponsors/SponsorsClientView";
import { SPONSORS_DATA, PARTNER_BENEFITS } from "@/data/sponsors";

export const metadata = publicPageMetadata("/sponsors");
export const revalidate = 60;

export default function SponsorsPage() {
  return (
    <div className="overflow-x-hidden text-white">
      <Header />
      <main id="main-content">
        <SponsorsClientView
          sponsors={SPONSORS_DATA}
          benefits={PARTNER_BENEFITS}
        />
      </main>
      <Footer />
    </div>
  );
}
