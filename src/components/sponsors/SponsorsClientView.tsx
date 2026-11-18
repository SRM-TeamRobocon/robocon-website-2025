"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Globe,
  Cpu,
  Users,
  Wrench,
  Handshake,
  ExternalLink,
  ArrowRight,
  Award,
  Sparkles,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import type { Sponsor, PartnerBenefit } from "@/data/sponsors";
import { SPONSORSHIP_CONTACT_HREF } from "@/data/sponsors";
import type { FlexCarouselProps } from "./FlexCarousel";

// Lazily load the WebGL FlexCarousel client-side only
const FlexCarousel = dynamic<FlexCarouselProps>(() => import("./FlexCarousel"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] flex flex-col items-center justify-center bg-black/60 border border-neutral-900 text-neutral-400">
      <div className="w-8 h-8 border-2 border-red border-t-transparent animate-spin mb-4" />
      <p className="text-sm tracking-wider uppercase">Initializing WebGL Engine...</p>
    </div>
  ),
});

const BENEFIT_ICONS: Record<string, React.ElementType> = {
  Globe,
  Cpu,
  Users,
  Wrench,
  Handshake,
};

function hasWebGL2Support(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

interface SponsorsClientViewProps {
  sponsors: Sponsor[];
  tiers: readonly string[];
  benefits: PartnerBenefit[];
}

export default function SponsorsClientView({
  sponsors,
  tiers,
  benefits,
}: SponsorsClientViewProps) {
  const [carouselItems, setCarouselItems] = useState<
    Array<{
      src: string;
      alt: string;
      title: string;
      subtitle: string;
      href?: string;
    }> | null
  >(null);
  const [activeSponsorIndex, setActiveSponsorIndex] = useState(0);
  const [webGLAvailable, setWebGLAvailable] = useState(true);

  // Generate crisp, standardized 800x600 cards for WebGL texture sampling
  useEffect(() => {
    let isCancelled = false;
    const canUseWebGL = hasWebGL2Support();
    setWebGLAvailable(canUseWebGL);

    if (!canUseWebGL) return;

    const generateCards = async () => {
      // Wait for Aldrich font to be ready if possible
      if (document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // ignore font load error
        }
      }

      const fontName = "var(--font-robocon), 'Aldrich', sans-serif";

      const promises = sponsors.map((sponsor) => {
        return new Promise<{
          src: string;
          alt: string;
          title: string;
          subtitle: string;
          href?: string;
        }>((resolve) => {
          const W = 800;
          const H = 600;
          const canvas = document.createElement("canvas");
          canvas.width = W;
          canvas.height = H;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            resolve({
              src: sponsor.logo,
              alt: `${sponsor.name} logo`,
              title: sponsor.name,
              subtitle: `${sponsor.category} • ${sponsor.domain}`,
              href: sponsor.website,
            });
            return;
          }

          // Dark tech background
          ctx.fillStyle = "#07080a";
          ctx.fillRect(0, 0, W, H);

          // Technical grid background
          ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
          ctx.lineWidth = 1;
          for (let x = 40; x < W; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
          }
          for (let y = 40; y < H; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
          }

          // Card Outer Border
          ctx.strokeStyle = sponsor.featured ? "#C20000" : "#262830";
          ctx.lineWidth = 6;
          ctx.strokeRect(3, 3, W - 6, H - 6);

          // Red corner indicators (Robocon sharp tech motif)
          ctx.fillStyle = "#C20000";
          ctx.fillRect(0, 0, 28, 6);
          ctx.fillRect(0, 0, 6, 28);
          ctx.fillRect(W - 28, 0, 28, 6);
          ctx.fillRect(W - 6, 0, 6, 28);
          ctx.fillRect(0, H - 6, 28, 6);
          ctx.fillRect(0, H - 28, 6, 28);
          ctx.fillRect(W - 28, H - 6, 28, 6);
          ctx.fillRect(W - 6, H - 28, 6, 28);

          // White logo container
          const boxW = 660;
          const boxH = 340;
          const boxX = (W - boxW) / 2;
          const boxY = 46;

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(boxX, boxY, boxW, boxH);
          ctx.strokeStyle = "#d1d5db";
          ctx.lineWidth = 2;
          ctx.strokeRect(boxX, boxY, boxW, boxH);

          // Draw the actual sponsor logo
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const padding = 36;
            const maxW = boxW - padding * 2;
            const maxH = boxH - padding * 2;
            const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
            const drawW = img.naturalWidth * scale;
            const drawH = img.naturalHeight * scale;
            const drawX = boxX + (boxW - drawW) / 2;
            const drawY = boxY + (boxH - drawH) / 2;
            ctx.drawImage(img, drawX, drawY, drawW, drawH);

            // Tier banner strip
            ctx.fillStyle = sponsor.featured ? "#C20000" : "#1b1d24";
            ctx.fillRect(boxX, 416, boxW, 40);

            ctx.fillStyle = "#ffffff";
            ctx.font = `bold 18px ${fontName}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(sponsor.category.toUpperCase(), W / 2, 436);

            // Sponsor Name
            ctx.fillStyle = "#ffffff";
            ctx.font = `bold 30px ${fontName}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const displayName =
              sponsor.name.length > 34 ? sponsor.name.slice(0, 32) + "..." : sponsor.name;
            ctx.fillText(displayName.toUpperCase(), W / 2, 494);

            // Sponsor Domain
            ctx.fillStyle = "#9ca3af";
            ctx.font = `18px ${fontName}`;
            ctx.fillText(sponsor.domain, W / 2, 542);

            resolve({
              src: canvas.toDataURL("image/png"),
              alt: `${sponsor.name} logo`,
              title: sponsor.name,
              subtitle: `${sponsor.category} • ${sponsor.domain}`,
              href: sponsor.website,
            });
          };

          img.onerror = () => {
            // Text fallback
            ctx.fillStyle = "#111827";
            ctx.fillRect(boxX, boxY, boxW, boxH);
            ctx.fillStyle = "#ffffff";
            ctx.font = `bold 36px ${fontName}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(sponsor.name, W / 2, boxY + boxH / 2);

            resolve({
              src: canvas.toDataURL("image/png"),
              alt: `${sponsor.name} logo`,
              title: sponsor.name,
              subtitle: `${sponsor.category} • ${sponsor.domain}`,
              href: sponsor.website,
            });
          };

          img.src = sponsor.logo;
        });
      });

      const items = await Promise.all(promises);
      if (!isCancelled) {
        setCarouselItems(items);
      }
    };

    generateCards();

    return () => {
      isCancelled = true;
    };
  }, [sponsors]);

  const activeSponsor = sponsors[activeSponsorIndex] || sponsors[0];

  const sponsorsByCategory = useMemo(() => {
    const map = new Map<string, Sponsor[]>();
    for (const tier of tiers) {
      map.set(
        tier,
        sponsors.filter((s) => s.category === tier)
      );
    }
    return map;
  }, [sponsors, tiers]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red selection:text-white">
      {/* SECTION 1: HERO SECTION */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden border-b border-neutral-900">
        {/* Subtle Tech Gradients and Grid Lines */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-red/30 blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neutral-700/20 blur-[140px]" />
          <div
            className="w-full h-full"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 md:px-12">
          {/* Eyebrow Tag */}
          <div
            data-aos="fade-down"
            className="inline-flex items-center gap-2 px-3 py-1 bg-red/10 border border-red/40 text-red text-xs md:text-sm tracking-widest uppercase mb-6"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Official Industry & Institutional Partners</span>
          </div>

          {/* Main Title & Subtitle */}
          <div data-aos="fade-up" className="max-w-4xl">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight uppercase leading-none mb-6">
              Our <span className="text-red">Sponsors</span>
            </h1>
            <h2 className="text-xl sm:text-2xl md:text-3xl text-neutral-300 font-medium tracking-wide uppercase mb-6 flex items-center gap-3">
              <span className="w-8 h-[2px] bg-red" />
              Building Innovation Together
            </h2>
            <p className="text-base sm:text-lg text-neutral-400 max-w-3xl leading-relaxed">
              We extend our sincere gratitude to the visionary organizations, industry leaders, and
              academic incubators that power SRM Team Robocon. Their cutting-edge software, precision
              hardware, and financial backing enable our students to design, simulate, and deploy
              world-class autonomous robots.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div
            data-aos="fade-up"
            data-aos-delay="100"
            className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl border-t border-neutral-900 pt-8"
          >
            <div>
              <p className="text-3xl font-bold text-white tracking-wider">8+</p>
              <p className="text-xs uppercase text-neutral-500 tracking-widest mt-1">
                Active Industry Partners
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red tracking-wider">5</p>
              <p className="text-xs uppercase text-neutral-500 tracking-widest mt-1">
                Sponsorship Tiers
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white tracking-wider">100%</p>
              <p className="text-xs uppercase text-neutral-500 tracking-widest mt-1">
                Engineering Collaboration
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white tracking-wider">ABU</p>
              <p className="text-xs uppercase text-neutral-500 tracking-widest mt-1">
                Robocon Stage
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: FLEX CAROUSEL — MAIN VISUAL FEATURE */}
      <section className="relative py-16 md:py-24 bg-neutral-950/60 border-b border-neutral-900">
        <div className="max-w-7xl mx-auto px-6 md:px-12 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-red mb-2">
              <span className="w-2 h-2 bg-red inline-block" />
              <span>Interactive 3D Carousel</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-tight">
              Featured Partner Technologies
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 mt-2 max-w-2xl">
              Drag, swipe, or use your arrow keys to explore our partners. Click on any card to focus
              and inspect details.
            </p>
          </div>

          {/* Active Partner Pill */}
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-black border border-neutral-800 text-sm">
            <span className="text-neutral-500 uppercase text-xs">Active:</span>
            <span className="text-white font-medium">{activeSponsor.name}</span>
            <span className="px-2 py-0.5 bg-red text-white text-xs font-bold uppercase">
              {activeSponsor.tierLabel}
            </span>
          </div>
        </div>

        {/* Carousel Viewport Container */}
        <div className="w-full relative">
          {webGLAvailable && carouselItems ? (
            <div className="relative w-full h-[520px] md:h-[600px]">
              <FlexCarousel
                items={carouselItems}
                preset="liquid"
                intro="rise"
                cardHeight={0.62}
                gap={16}
                radius={0}
                squeeze={0.2}
                focusOnClick={true}
                autoplay={true}
                interval={4.5}
                captions={true}
                onChange={(index: number) => {
                  if (typeof index === "number" && index >= 0 && index < sponsors.length) {
                    setActiveSponsorIndex(index);
                  }
                }}
              />
            </div>
          ) : (
            /* Fallback Responsive Grid if WebGL2 is disabled or loading */
            <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {sponsors.map((sponsor) => (
                <a
                  key={sponsor.id}
                  href={sponsor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-neutral-900/90 border border-neutral-800 hover:border-red p-6 flex flex-col items-center justify-center transition-all duration-300"
                >
                  <div className="bg-white w-full h-32 p-4 flex items-center justify-center mb-4">
                    <Image
                      src={sponsor.logo}
                      alt={sponsor.name}
                      width={180}
                      height={90}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <span className="text-xs uppercase text-red font-bold tracking-wider mb-1">
                    {sponsor.tierLabel}
                  </span>
                  <p className="text-sm font-bold text-center text-white line-clamp-1">
                    {sponsor.name}
                  </p>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Active Sponsor Detail Bar */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 mt-8">
          <div className="bg-black/80 border border-neutral-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="px-2.5 py-0.5 bg-red text-white text-xs font-bold uppercase tracking-wider">
                  {activeSponsor.tierLabel}
                </span>
                <span className="text-xs uppercase text-neutral-400 tracking-wider">
                  {activeSponsor.domain}
                </span>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-white uppercase">
                {activeSponsor.name}
              </h3>
              <p className="text-sm text-neutral-400 mt-1 max-w-3xl leading-relaxed">
                {activeSponsor.description}
              </p>
            </div>
            <a
              href={activeSponsor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-red text-white text-xs uppercase tracking-widest font-bold border border-neutral-700 hover:border-red transition-all duration-200 shrink-0"
            >
              <span>Visit Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 3: OUR SPONSORS — COMPREHENSIVE SHOWCASE */}
      <section className="py-20 md:py-28 max-w-7xl mx-auto px-6 md:px-12">
        <div className="border-b border-neutral-900 pb-8 mb-16">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-red mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Official Roster</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold uppercase tracking-tight">
            Sponsorship Categories
          </h2>
          <p className="text-sm sm:text-base text-neutral-400 mt-2 max-w-2xl">
            Our partners are classified into distinct tiers reflecting their strategic contribution to
            our robotics research, prototyping, and competition infrastructure.
          </p>
        </div>

        {/* 1. TITLE SPONSOR */}
        {sponsorsByCategory.get("Title Sponsor")?.length ? (
          <div className="mb-20" data-aos="fade-up">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-4 h-4 bg-red inline-block" />
              <h3 className="text-xl md:text-2xl font-bold uppercase tracking-wider text-red">
                Title Sponsor & Incubation Partner
              </h3>
            </div>

            {sponsorsByCategory.get("Title Sponsor")!.map((sponsor) => (
              <div
                key={sponsor.id}
                className="relative bg-neutral-950 border-2 border-red p-8 md:p-12 flex flex-col lg:flex-row items-center gap-10 shadow-[0_0_50px_rgba(194,0,0,0.15)] group"
              >
                {/* Tech corner accents */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white" />

                {/* Prominent Logo */}
                <div className="bg-white w-full lg:w-96 h-56 p-8 flex items-center justify-center shrink-0 border border-neutral-300">
                  <Image
                    src={sponsor.logo}
                    alt={sponsor.name}
                    width={320}
                    height={160}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="inline-block px-3 py-1 bg-red text-white text-xs font-bold uppercase tracking-widest mb-4">
                    Principal Institutional Patron
                  </div>
                  <h4 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-tight mb-2">
                    {sponsor.name}
                  </h4>
                  <p className="text-sm md:text-base text-red font-semibold uppercase tracking-wider mb-4">
                    {sponsor.domain}
                  </p>
                  <p className="text-neutral-300 leading-relaxed text-sm md:text-base mb-8">
                    {sponsor.description}
                  </p>
                  <a
                    href={sponsor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-6 py-3 bg-red hover:bg-[#a00000] text-white text-xs md:text-sm uppercase tracking-widest font-bold transition-all duration-200"
                  >
                    <span>Visit Official Website</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* 2. PLATINUM SPONSORS */}
        {sponsorsByCategory.get("Platinum Sponsors")?.length ? (
          <div className="mb-20" data-aos="fade-up">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-3 h-3 bg-white inline-block" />
              <h3 className="text-lg md:text-xl font-bold uppercase tracking-wider text-white">
                Platinum Sponsors
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {sponsorsByCategory.get("Platinum Sponsors")!.map((sponsor) => (
                <div
                  key={sponsor.id}
                  className="bg-neutral-950 border border-neutral-800 hover:border-red flex flex-col p-6 transition-all duration-300 group"
                >
                  <div className="bg-white w-full h-44 p-6 flex items-center justify-center mb-6">
                    <Image
                      src={sponsor.logo}
                      alt={sponsor.name}
                      width={240}
                      height={120}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="text-xs uppercase text-red font-bold tracking-wider mb-1">
                    {sponsor.tierLabel}
                  </div>
                  <h4 className="text-lg font-bold text-white uppercase tracking-tight mb-2">
                    {sponsor.name}
                  </h4>
                  <p className="text-xs text-neutral-400 font-medium uppercase tracking-wider mb-3">
                    {sponsor.domain}
                  </p>
                  <p className="text-sm text-neutral-300 leading-relaxed flex-1 mb-6">
                    {sponsor.description}
                  </p>
                  <a
                    href={sponsor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-neutral-400 hover:text-red transition-colors pt-4 border-t border-neutral-900"
                  >
                    <span>Visit Partner</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 3. GOLD SPONSORS */}
        {sponsorsByCategory.get("Gold Sponsors")?.length ? (
          <div className="mb-20" data-aos="fade-up">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-3 h-3 bg-amber-500 inline-block" />
              <h3 className="text-lg md:text-xl font-bold uppercase tracking-wider text-white">
                Gold Sponsors
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sponsorsByCategory.get("Gold Sponsors")!.map((sponsor) => (
                <div
                  key={sponsor.id}
                  className="bg-neutral-950 border border-neutral-800 hover:border-red flex flex-col sm:flex-row items-center p-6 gap-6 transition-all duration-300 group"
                >
                  <div className="bg-white w-full sm:w-48 h-36 p-4 flex items-center justify-center shrink-0">
                    <Image
                      src={sponsor.logo}
                      alt={sponsor.name}
                      width={180}
                      height={90}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs uppercase text-amber-500 font-bold tracking-wider mb-1">
                      {sponsor.tierLabel}
                    </div>
                    <h4 className="text-base md:text-lg font-bold text-white uppercase tracking-tight mb-1">
                      {sponsor.name}
                    </h4>
                    <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">
                      {sponsor.domain}
                    </p>
                    <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mb-4">
                      {sponsor.description}
                    </p>
                    <a
                      href={sponsor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold text-neutral-400 hover:text-red transition-colors"
                    >
                      <span>Explore Technology</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 4. SILVER SPONSORS & SUPPORTING PARTNERS */}
        {(sponsorsByCategory.get("Silver Sponsors")?.length ||
          sponsorsByCategory.get("Supporting Partners")?.length) ? (
          <div data-aos="fade-up">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-3 h-3 bg-neutral-400 inline-block" />
              <h3 className="text-lg md:text-xl font-bold uppercase tracking-wider text-white">
                Silver Sponsors & Technical Partners
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                ...(sponsorsByCategory.get("Silver Sponsors") || []),
                ...(sponsorsByCategory.get("Supporting Partners") || []),
              ].map((sponsor) => (
                <div
                  key={sponsor.id}
                  className="bg-neutral-950 border border-neutral-800 hover:border-red flex flex-col sm:flex-row items-center p-6 gap-6 transition-all duration-300 group"
                >
                  <div className="bg-white w-full sm:w-48 h-36 p-4 flex items-center justify-center shrink-0">
                    <Image
                      src={sponsor.logo}
                      alt={sponsor.name}
                      width={180}
                      height={90}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs uppercase text-neutral-400 font-bold tracking-wider mb-1">
                      {sponsor.tierLabel}
                    </div>
                    <h4 className="text-base md:text-lg font-bold text-white uppercase tracking-tight mb-1">
                      {sponsor.name}
                    </h4>
                    <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">
                      {sponsor.domain}
                    </p>
                    <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mb-4">
                      {sponsor.description}
                    </p>
                    <a
                      href={sponsor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold text-neutral-400 hover:text-red transition-colors"
                    >
                      <span>Explore Technology</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* SECTION 4: WHY PARTNER WITH US? */}
      <section className="py-20 md:py-28 bg-neutral-950/80 border-y border-neutral-900 relative">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-red mb-2">
              <Award className="w-4 h-4" />
              <span>Strategic Collaboration</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold uppercase tracking-tight">
              Why Partner With Us?
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 mt-3 leading-relaxed">
              Partnering with SRM Team Robocon creates tangible technical and brand dividends for your
              organization, linking industrial solutions with rigorous competition robotics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, idx) => {
              const IconComp = BENEFIT_ICONS[benefit.icon] || Cpu;
              return (
                <div
                  key={benefit.title}
                  data-aos="fade-up"
                  data-aos-delay={idx * 80}
                  className="bg-black border border-neutral-800 hover:border-red p-8 flex flex-col justify-between transition-all duration-300 group"
                >
                  <div>
                    <div className="w-12 h-12 bg-neutral-900 border border-neutral-700 flex items-center justify-center text-red group-hover:bg-red group-hover:text-white transition-colors duration-200 mb-6">
                      <IconComp className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-white uppercase tracking-tight mb-3">
                      {benefit.title}
                    </h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">
                      {benefit.description}
                    </p>
                  </div>
                  <div className="pt-6 mt-6 border-t border-neutral-900 flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-500 group-hover:text-red transition-colors">
                    <span>Key Partner Advantage</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 5: BECOME A SPONSOR — CTA */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-red/15 blur-[160px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 md:px-12 text-center" data-aos="fade-up">
          <div className="inline-block px-3 py-1 bg-red/10 border border-red/40 text-red text-xs md:text-sm tracking-widest uppercase mb-6 font-bold">
            Join Our Innovation Journey
          </div>

          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-tight mb-6">
            Become a Part of Our Journey
          </h2>

          <p className="text-base sm:text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto leading-relaxed mb-10">
            Partner with us to support innovation, engineering and the next generation of technology.
            Let us build the future of autonomous systems together.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <a
              href={SPONSORSHIP_CONTACT_HREF}
              className="w-full sm:w-auto px-10 py-4 bg-red hover:bg-[#a00000] text-white text-sm uppercase tracking-widest font-bold shadow-[0_0_30px_rgba(194,0,0,0.4)] transition-all duration-200"
            >
              Become a Sponsor
            </a>

            <a
              href="#contact"
              className="w-full sm:w-auto px-8 py-4 bg-transparent border border-neutral-700 hover:border-white text-white text-sm uppercase tracking-widest font-bold transition-all duration-200"
            >
              Contact Team Leads
            </a>
          </div>

          {/* Institutional note */}
          <p className="text-xs uppercase tracking-widest text-neutral-500 mt-12">
            SRM Team ROBOCON Lab • Aarush Building, SRMIST Main Campus, Kattankulathur
          </p>
        </div>
      </section>
    </div>
  );
}
