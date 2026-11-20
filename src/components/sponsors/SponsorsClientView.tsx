"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
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
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Mail,
  Phone,
} from "lucide-react";
import type { Sponsor, PartnerBenefit } from "@/data/sponsors";
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
  benefits: PartnerBenefit[];
}

export default function SponsorsClientView({
  sponsors,
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

  // Form Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyName: "",
    companyWebsite: "",
    contactName: "",
    officialEmail: "",
    phoneNumber: "",
    supportType: "",
    partnershipDetails: "",
    additionalMessage: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const modalRef = useRef<HTMLDivElement>(null);

  // Trap escape key and background scroll when modal is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFormOpen) {
        handleCloseModal();
      }
    };

    if (isFormOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFormOpen]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      errors.companyName = "Company or Organization name is required";
    }

    if (formData.companyWebsite.trim()) {
      const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
      if (!urlPattern.test(formData.companyWebsite.trim())) {
        errors.companyWebsite = "Please enter a valid website URL (e.g. https://example.com)";
      }
    }

    if (!formData.contactName.trim()) {
      errors.contactName = "Contact person name is required";
    }

    if (!formData.officialEmail.trim()) {
      errors.officialEmail = "Official email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.officialEmail.trim())) {
      errors.officialEmail = "Please enter a valid official email address";
    }

    if (!formData.phoneNumber.trim()) {
      errors.phoneNumber = "Phone number is required";
    } else if (formData.phoneNumber.trim().length < 6) {
      errors.phoneNumber = "Please enter a valid phone number";
    }

    if (!formData.supportType) {
      errors.supportType = "Please select a type of support";
    }

    if (!formData.partnershipDetails.trim()) {
      errors.partnershipDetails = "Sponsorship interest / partnership details are required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/sponsors/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit enquiry. Please try again.");
      }

      setIsSubmitted(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to submit enquiry. Please try again.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setIsFormOpen(false);
    setIsSubmitted(false);
    setSubmitError(null);
    setFormErrors({});
    setFormData({
      companyName: "",
      companyWebsite: "",
      contactName: "",
      officialEmail: "",
      phoneNumber: "",
      supportType: "",
      partnershipDetails: "",
      additionalMessage: "",
    });
  };

  // Generate crisp, standardized 800x600 cards for WebGL texture sampling (no tiers)
  useEffect(() => {
    let isCancelled = false;
    const canUseWebGL = hasWebGL2Support();
    setWebGLAvailable(canUseWebGL);

    if (!canUseWebGL) return;

    const generateCards = async () => {
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
              subtitle: sponsor.domain,
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
          const boxH = 360;
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

            // Red divider accent line
            ctx.fillStyle = "#C20000";
            ctx.fillRect(boxX, 436, boxW, 4);

            // Sponsor Name
            ctx.fillStyle = "#ffffff";
            ctx.font = `bold 32px ${fontName}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const displayName =
              sponsor.name.length > 34 ? sponsor.name.slice(0, 32) + "..." : sponsor.name;
            ctx.fillText(displayName.toUpperCase(), W / 2, 480);

            // Sponsor Domain
            ctx.fillStyle = "#a3aab8";
            ctx.font = `18px ${fontName}`;
            ctx.fillText(sponsor.domain, W / 2, 535);

            resolve({
              src: canvas.toDataURL("image/png"),
              alt: `${sponsor.name} logo`,
              title: sponsor.name,
              subtitle: sponsor.domain,
              href: sponsor.website,
            });
          };

          img.onerror = () => {
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
              subtitle: sponsor.domain,
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

  return (
    <div className="min-h-screen bg-transparent text-white selection:bg-red selection:text-white">
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

          {/* Quick Metrics Bar (No Tiers) */}
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
              <p className="text-3xl font-bold text-red tracking-wider">100%</p>
              <p className="text-xs uppercase text-neutral-500 tracking-widest mt-1">
                Engineering Collaboration
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white tracking-wider">R&D</p>
              <p className="text-xs uppercase text-neutral-500 tracking-widest mt-1">
                Prototyping & Simulation
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

          {/* Active Partner Pill (No Tiers) */}
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-black border border-neutral-800 text-sm">
            <span className="text-neutral-500 uppercase text-xs">Active Partner:</span>
            <span className="text-white font-medium">{activeSponsor.name}</span>
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
            /* Fallback Responsive Grid (No Tiers) */
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
                  <p className="text-sm font-bold text-center text-white line-clamp-1">
                    {sponsor.name}
                  </p>
                  <p className="text-xs text-neutral-400 text-center mt-1 line-clamp-1">
                    {sponsor.domain}
                  </p>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Active Sponsor Detail Bar (No Tiers) */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 mt-8">
          <div className="bg-black/80 border border-neutral-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex-1">
              <span className="text-xs uppercase text-red font-bold tracking-wider mb-1 block">
                {activeSponsor.domain}
              </span>
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

      {/* SECTION 3: OUR SPONSORS & PARTNERS (COMPLETELY TIER-FREE SHOWCASE) */}
      <section className="py-20 md:py-28 max-w-7xl mx-auto px-6 md:px-12">
        <div className="border-b border-neutral-900 pb-8 mb-16">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-red mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Strategic Alliance</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold uppercase tracking-tight">
            Our Partners
          </h2>
          <p className="text-sm sm:text-base text-neutral-400 mt-2 max-w-2xl">
            Meet the innovative technology providers, simulation architects, and institutional sponsors
            who empower our engineering teams.
          </p>
        </div>

        {/* Clean, Unified Partner Grid with zero tier classifications */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8" data-aos="fade-up">
          {sponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              className="relative bg-neutral-950 border border-neutral-800 hover:border-red flex flex-col sm:flex-row items-center p-6 sm:p-8 gap-6 sm:gap-8 transition-all duration-300 group"
            >
              {/* Tech corner accent */}
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-neutral-700 group-hover:border-red transition-colors" />

              {/* Logo Box */}
              <div className="bg-white w-full sm:w-56 h-36 sm:h-40 p-4 flex items-center justify-center shrink-0 border border-neutral-200">
                <Image
                  src={sponsor.logo}
                  alt={sponsor.name}
                  width={200}
                  height={100}
                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Content */}
              <div className="flex-1 text-center sm:text-left">
                <p className="text-xs text-red font-bold uppercase tracking-wider mb-1">
                  {sponsor.domain}
                </p>
                <h3 className="text-lg sm:text-xl font-bold text-white uppercase tracking-tight mb-2">
                  {sponsor.name}
                </h3>
                <p className="text-sm text-neutral-400 leading-relaxed mb-4">
                  {sponsor.description}
                </p>
                <a
                  href={sponsor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold text-neutral-300 hover:text-red transition-colors"
                >
                  <span>Visit Website</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
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

      {/* SECTION 5: BECOME A SPONSOR — CENTRED CTA */}
      <section className="py-24 md:py-32 relative overflow-hidden text-center">
        {/* Subtle background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-red/15 blur-[160px]" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 md:px-12 flex flex-col items-center justify-center" data-aos="fade-up">
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

          {/* Centred Primary CTA Button (Contact Team Lead completely removed) */}
          <div className="flex justify-center w-full">
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="px-12 py-4 bg-red hover:bg-[#a00000] text-white text-sm md:text-base uppercase tracking-widest font-bold shadow-[0_0_35px_rgba(194,0,0,0.45)] hover:shadow-[0_0_50px_rgba(194,0,0,0.7)] hover:scale-105 active:scale-95 transition-all duration-300 border-none cursor-pointer"
            >
              Become a Sponsor
            </button>
          </div>

          {/* Institutional note */}
          <p className="text-xs uppercase tracking-widest text-neutral-500 mt-12">
            SRM Team ROBOCON Lab • Aarush Building, SRMIST Main Campus, Kattankulathur
          </p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 6: BECOME A SPONSOR MODAL & THANK YOU CONFIRMATION */}
      {/* ========================================================================= */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sponsor-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div
            ref={modalRef}
            className="relative w-full max-w-2xl bg-[#090a0d] border border-neutral-800 text-white my-8 shadow-[0_0_60px_rgba(0,0,0,0.95)] animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Tech Corner Accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-red pointer-events-none" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-red pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-red pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-red pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-neutral-800/80">
              <div>
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-red mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sponsorship Partnership</span>
                </div>
                <h3 id="sponsor-modal-title" className="text-2xl sm:text-3xl font-bold uppercase tracking-tight">
                  {isSubmitted ? "Submission Received" : "Become a Sponsor"}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-neutral-400 hover:text-white p-2 transition-colors cursor-pointer"
                aria-label="Close form"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 max-h-[75vh] overflow-y-auto">
              {isSubmitted ? (
                /* 5. THANK YOU CONFIRMATION */
                <div className="py-8 px-4 text-center flex flex-col items-center justify-center animate-in fade-in duration-300">
                  <div className="w-16 h-16 bg-red/10 border-2 border-red flex items-center justify-center text-red mb-6 shadow-[0_0_30px_rgba(194,0,0,0.3)]">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <h4 className="text-3xl sm:text-4xl font-bold uppercase tracking-tight text-white mb-4">
                    THANK YOU!
                  </h4>

                  <p className="text-lg text-neutral-200 font-semibold mb-3">
                    Your enquiry has been submitted successfully.
                  </p>

                  <p className="text-sm text-neutral-400 max-w-md mx-auto leading-relaxed mb-8">
                    Our team will review your enquiry and get in touch with you soon.
                  </p>

                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-10 py-3.5 bg-red hover:bg-[#a00000] text-white text-sm uppercase tracking-widest font-bold transition-all duration-200 border-none cursor-pointer shadow-[0_0_20px_rgba(194,0,0,0.3)]"
                  >
                    Close
                  </button>
                </div>
              ) : (
                /* 4. BECOME A SPONSOR FORM */
                <form onSubmit={handleSubmit} noValidate className="space-y-6">
                  {submitError && (
                    <div className="p-4 bg-red/15 border border-red text-red text-sm flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Company Details */}
                  <div>
                    <h4 className="text-xs uppercase tracking-widest text-red font-bold mb-4 pb-1 border-b border-neutral-900">
                      Company Details
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* 1. Company Name */}
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1.5 font-medium">
                          Company / Organization Name <span className="text-red">*</span>
                        </label>
                        <input
                          type="text"
                          name="companyName"
                          value={formData.companyName}
                          onChange={handleInputChange}
                          placeholder="e.g. Acme Robotics Inc."
                          className={`w-full bg-[#111318] border ${
                            formErrors.companyName ? "border-red" : "border-neutral-800"
                          } focus:border-red focus:outline-none text-white text-sm px-3.5 py-2.5 transition-colors placeholder:text-neutral-600`}
                        />
                        {formErrors.companyName && (
                          <p className="text-red text-xs mt-1">{formErrors.companyName}</p>
                        )}
                      </div>

                      {/* 2. Company Website */}
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1.5 font-medium">
                          Company Website
                        </label>
                        <input
                          type="url"
                          name="companyWebsite"
                          value={formData.companyWebsite}
                          onChange={handleInputChange}
                          placeholder="e.g. https://acmerobotics.com"
                          className={`w-full bg-[#111318] border ${
                            formErrors.companyWebsite ? "border-red" : "border-neutral-800"
                          } focus:border-red focus:outline-none text-white text-sm px-3.5 py-2.5 transition-colors placeholder:text-neutral-600`}
                        />
                        {formErrors.companyWebsite && (
                          <p className="text-red text-xs mt-1">{formErrors.companyWebsite}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div>
                    <h4 className="text-xs uppercase tracking-widest text-red font-bold mb-4 pb-1 border-b border-neutral-900">
                      Contact Details
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* 3. Contact Person Name */}
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1.5 font-medium">
                          Contact Person Name <span className="text-red">*</span>
                        </label>
                        <input
                          type="text"
                          name="contactName"
                          value={formData.contactName}
                          onChange={handleInputChange}
                          placeholder="e.g. Jane Doe"
                          className={`w-full bg-[#111318] border ${
                            formErrors.contactName ? "border-red" : "border-neutral-800"
                          } focus:border-red focus:outline-none text-white text-sm px-3.5 py-2.5 transition-colors placeholder:text-neutral-600`}
                        />
                        {formErrors.contactName && (
                          <p className="text-red text-xs mt-1">{formErrors.contactName}</p>
                        )}
                      </div>

                      {/* 4. Official Email */}
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1.5 font-medium">
                          Official Email <span className="text-red">*</span>
                        </label>
                        <input
                          type="email"
                          name="officialEmail"
                          value={formData.officialEmail}
                          onChange={handleInputChange}
                          placeholder="e.g. jane@company.com"
                          className={`w-full bg-[#111318] border ${
                            formErrors.officialEmail ? "border-red" : "border-neutral-800"
                          } focus:border-red focus:outline-none text-white text-sm px-3.5 py-2.5 transition-colors placeholder:text-neutral-600`}
                        />
                        {formErrors.officialEmail && (
                          <p className="text-red text-xs mt-1">{formErrors.officialEmail}</p>
                        )}
                      </div>

                      {/* 5. Phone Number */}
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1.5 font-medium">
                          Phone Number <span className="text-red">*</span>
                        </label>
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          placeholder="e.g. +91 98765 43210"
                          className={`w-full bg-[#111318] border ${
                            formErrors.phoneNumber ? "border-red" : "border-neutral-800"
                          } focus:border-red focus:outline-none text-white text-sm px-3.5 py-2.5 transition-colors placeholder:text-neutral-600`}
                        />
                        {formErrors.phoneNumber && (
                          <p className="text-red text-xs mt-1">{formErrors.phoneNumber}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sponsorship Details */}
                  <div>
                    <h4 className="text-xs uppercase tracking-widest text-red font-bold mb-4 pb-1 border-b border-neutral-900">
                      Sponsorship Details
                    </h4>

                    {/* 6. Type of Support */}
                    <div className="mb-4">
                      <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1.5 font-medium">
                        Type of Support <span className="text-red">*</span>
                      </label>
                      <select
                        name="supportType"
                        value={formData.supportType}
                        onChange={handleInputChange}
                        className={`w-full bg-[#111318] border ${
                          formErrors.supportType ? "border-red" : "border-neutral-800"
                        } focus:border-red focus:outline-none text-white text-sm px-3.5 py-2.5 transition-colors`}
                      >
                        <option value="" disabled className="bg-[#111318] text-neutral-500">
                          Select type of support
                        </option>
                        <option value="Financial" className="bg-[#111318] text-white">
                          Financial
                        </option>
                        <option value="Technical" className="bg-[#111318] text-white">
                          Technical
                        </option>
                        <option value="Equipment" className="bg-[#111318] text-white">
                          Equipment
                        </option>
                        <option value="Other" className="bg-[#111318] text-white">
                          Other
                        </option>
                      </select>
                      {formErrors.supportType && (
                        <p className="text-red text-xs mt-1">{formErrors.supportType}</p>
                      )}
                    </div>

                    {/* 7. Sponsorship Interest / Partnership Details */}
                    <div className="mb-4">
                      <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1.5 font-medium">
                        Sponsorship Interest / Partnership Details <span className="text-red">*</span>
                      </label>
                      <textarea
                        name="partnershipDetails"
                        rows={3}
                        value={formData.partnershipDetails}
                        onChange={handleInputChange}
                        placeholder="Please describe how you would like to collaborate with SRM Team Robocon (e.g. equipment provisioning, technical licensing, financial support, etc.)..."
                        className={`w-full bg-[#111318] border ${
                          formErrors.partnershipDetails ? "border-red" : "border-neutral-800"
                        } focus:border-red focus:outline-none text-white text-sm px-3.5 py-2.5 transition-colors placeholder:text-neutral-600 resize-y`}
                      />
                      {formErrors.partnershipDetails && (
                        <p className="text-red text-xs mt-1">{formErrors.partnershipDetails}</p>
                      )}
                    </div>

                    {/* 8. Additional Message */}
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1.5 font-medium">
                        Additional Message <span className="text-neutral-500 text-[10px]">(Optional)</span>
                      </label>
                      <textarea
                        name="additionalMessage"
                        rows={2}
                        value={formData.additionalMessage}
                        onChange={handleInputChange}
                        placeholder="Any additional information, preferred contact times, or questions for our leads..."
                        className="w-full bg-[#111318] border border-neutral-800 focus:border-red focus:outline-none text-white text-sm px-3.5 py-2.5 transition-colors placeholder:text-neutral-600 resize-y"
                      />
                    </div>
                  </div>

                  {/* Submit Button & Close Action */}
                  <div className="pt-4 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-6 py-3 bg-transparent border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white text-xs uppercase tracking-widest font-bold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-10 py-3.5 bg-red hover:bg-[#a00000] disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs uppercase tracking-widest font-bold transition-all duration-200 flex items-center justify-center gap-2 border-none cursor-pointer shadow-[0_0_25px_rgba(194,0,0,0.35)]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting Enquiry...</span>
                        </>
                      ) : (
                        <span>Submit Enquiry</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
