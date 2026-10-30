import CountUpUnit from "@/components/CountUpUnit";
import Image from "next/image";
import Link from "next/link";
import SponsorCarousel from "@/components/SponsorCarousel";
import {
  noOfAlumni,
  noOfParticipations,
  noOfRobots,
} from "@/constants/constants";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RecruitmentSection from "@/components/RecruitmentSection";
import HalloweenPhotoBooth from "@/components/HalloweenPhotoBooth";
import HalloweenHero from "@/components/HalloweenHero";
import "./halloween.css";
import { publicPageMetadata, serializeJsonLd, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

// Flip this off to remove the temporary homepage theme and photo booth.
const HALLOWEEN_THEME = true;

export const metadata = publicPageMetadata("/");

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/LOGO.png`,
      description: SITE_DESCRIPTION,
      foundingDate: "2011",
      address: {
        "@type": "PostalAddress",
        streetAddress: "SRM Team Robocon Lab, Aarush Building, SRMIST Main Campus",
        addressLocality: "Kattankulathur",
        addressRegion: "Tamil Nadu",
        postalCode: "603203",
        addressCountry: "IN",
      },
      sameAs: [
        "https://www.facebook.com/roboconindia/",
        "https://in.linkedin.com/company/srmteamrobocon/",
        "https://www.instagram.com/srmteamrobocon/",
        "https://www.youtube.com/channel/UCDPES1-ulIEMp-mEpOsdaoA/",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-IN",
    },
  ],
};

export default function Home() {
  return (
    <div className={HALLOWEEN_THEME ? "halloween-home overflow-x-hidden" : "overflow-x-hidden"}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      <Header animate />
      <main id="main-content">
      {/* First section */}
      {HALLOWEEN_THEME ? <HalloweenHero /> : <section className="w-full md:h-full overflow-x-hidden">
        {/* Hero srction */}
        <div className="flex items-center gap-10 md:gap-44 flex-col md:flex-row">
          <div>
            <div
              className="bg-white p-10 border-blue-500 w-[1000px] md:w-[600px] hero-clip md:pr-32 mt-10 flex-shrink-0 flex justify-center"
              data-aos="slide-right"
            >
              <Image
                src={"/LOGO.png"}
                alt="SRM Team Robocon logo"
                width={400}
                height={400}
                className="w-72 md:w-96"
                priority
                sizes="(min-width: 768px) 384px, 288px"
              ></Image>
            </div>
          </div>
            <div
              className="flex flex-col gap-5 mx-10"
              data-aos="fade-right"
              data-aos-delay="400"
              data-aos-anchor-placement="top-bottom"
            >
            <h1 className="flex flex-col gap-5 text-5xl font-bold">
              <span className="sr-only">SRM Team Robocon: </span>
              <span className="text-red">Robotics</span>
              <span className="pl-10 text-white">Reimagined</span>
            </h1>
            <div className="text-xl md:pr-20 pt-5 border-t-2 border-red text-white">
              We are the official robotics team of SRMIST, Kattankulathur, participating in{" "}
              <Link
                href="https://aburobocon2027.id"
                className="hover:text-red hover:cursor-pointer underline underline-offset-4 whitespace-nowrap"
              >
                ABU Robocon
              </Link>{" "}
              <br /> since the year 2011, and much More.{" "}
            </div>
            {HALLOWEEN_THEME && <Link href="#halloween-booth" className="w-fit rounded-full border border-[#c88af4]/70 bg-[#51235f]/50 px-5 py-3 font-semibold text-white transition hover:bg-[#74358a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Enter the photo lab</Link>}
          </div>
        </div>
        <div className="md:flex justify-center mt-14 hidden">
          <Image
            src={"/downArrow.svg"}
            alt=""
            width={50}
            height={50}
            className="animate-bounce motion-reduce:animate-none"
          ></Image>
        </div>
      </section>}

      {HALLOWEEN_THEME && <HalloweenPhotoBooth />}

      {/* <section className="relative max-md:mt-20">
        <HackathonSection />
      </section> */}

      {/*Workshop section*/}
      {/* <section className="relative max-md:mt-20">
        <WorkshopSection />
      </section> */}

{/*
      <section className="">
        <JoselinSection />
      </section> */}
      <section className="relative max-md:mt-20">
        <RecruitmentSection />
      </section>

      {/* Second section */}
      <section className="w-full h-full md:h-screen flex flex-col items-center justify-center mt-20 md:mt-0">
        <div className="flex flex-col items-center">
          <div className="flex flex-wrap gap-4 md:gap-0 w-full justify-center">

            <div className="flex items-center justify-center gap-10 flex-wrap text-white">
              <div className="flex flex-col justify-center items-center">
                <div className="text-4xl md:text-6xl flex items-center justify-center w-32 md:w-48">
                  75


                </div>
                <div className="w-full text-wrap text-center mt-2">
                  Team Members
                </div>
              </div>
            </div>

            <CountUpUnit upto={noOfRobots} label="Robots" />
            <CountUpUnit upto={noOfParticipations} label="Participations / year" />
            <CountUpUnit upto={noOfAlumni} label="Alumni" />
          </div>
          <div className="text-3xl m-12 text-center text-white">
            GROWING <span className="text-red">STRONGER</span> BY THE SECOND
          </div>
        </div>
        <div className="flex md:justify-center justify-around flex-wrap lg:flex-nowrap gap-16 px-10 md:gap-44 mt-20 w-full">
          <div className="border-l-4 border-red">
            <div
              className="md:w-[500px] px-5 md:px-10 w-full text-white"
            >
              <h2 className="text-3xl mb-5 font-bold">Our Mission</h2>
              <p className="text-xl w-full">
                Reimagine the knowledge from robotics into producing a solution
                for the growing society, for a better tomorrow.
              </p>
            </div>
          </div>
          <div className="border-l-4 border-red">
            <div
              className="md:w-[500px] px-5 md:px-10 w-full"
            >
              <h2 className="text-3xl mb-5 font-bold text-white">Our Vision</h2>
              <div className="text-xl w-full text-white">
                Emerge as a renowned robotics systems lab centred at SRMIST,
                INDIA by inculcating a collaborative work culture.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/*Banner section*/}
      {/* <section className="relative max-md:mt-20">
        <RoboConEvent />
      </section> */}

      {/*Recruitment section*/}
      {/* <section className="relative max-md:mt-20">
        <RecruitmentSection /> */}
      {/* Third section */}

      {/*<section className="w-full h-full mt-20">
        <WorkshopReg />
      </section> */}
      <section className="w-full h-full">
        <h2 className="text-3xl md:text-4xl pl-10 md:pl-44 mt-44 text-white">
          Our Sponsors
        </h2>
        <SponsorCarousel />
      </section>

      </main>
      {/* Footer */}
      <Footer />
    </div>
  );
}
