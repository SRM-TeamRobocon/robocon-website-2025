"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { InlineChatWidget } from "@/components/recruit/ChatWidget";


const recruitmentVideos = [
    {
        id: "DppLeh1YmeA",
        title: "SRM Team Robocon Game Highlight 1",
    },
    {
        id: "0JPGYL9jRVo",
        title: "SRM Team Robocon Game Highlight 2",
    },
    {
        id: "belplHIsqZE",
        title: "SRM Team Robocon Game Highlight 3",
    },
];

const domains = [
    {
        acronym: "SAMBED",
        full: "Structural Architecture & Mechanical Body Engineering",
        blurb: "You design it. You build it. You watch it survive the arena.",
    },
    {
        acronym: "SPACED",
        full: "Systems Programming, Analysis & Computation Engineering",
        blurb: "Code the brain — Arduino to Jetson, sensors to autonomous navigation.",
    },
    {
        acronym: "SIESED",
        full: "System Integration & Electronics Subsystem Engineering",
        blurb: "Wire the nervous system linking mechanical muscle to digital command.",
    },
    {
        acronym: "MCSOCD",
        full: "Media Creation & Social Outreach Creatives",
        blurb: "Own the story — content, design, events, sponsors. No robot wins unseen.",
    },
];

const RecruitmentSection = () => {
    const router = useRouter();

    return (
        <section className="relative isolate w-full overflow-hidden bg-white py-16 md:py-24 px-4 md:px-8">
            {/* Deliberately breaks from the site's dark/glass theme — a bold white
                poster block meant to interrupt the page and grab attention, with
                angled red edges echoing the clip-path cuts used elsewhere on site
                (see the video cards below, and the join-popup modal in page.tsx). */}
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-3 md:h-5 bg-red"
                style={{ clipPath: "polygon(0 0,100% 0,100% 100%,0 35%)" }}
            />
            <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-3 md:h-5 bg-red"
                style={{ clipPath: "polygon(0 65%,100% 0,100% 100%,0 100%)" }}
            />

            <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-14 md:gap-20">
                {/* Headline */}
                <div className="max-w-3xl text-center">
                    <div className="mb-6 inline-block max-w-full bg-red px-4 py-1.5 text-xs font-bold tracking-[0.24em] text-white md:text-sm md:tracking-[0.3em]">
                        RECRUITMENT
                    </div>
                    <h1 className="text-black text-5xl font-bold leading-[1.02] tracking-tight md:text-7xl">
                        DARE TO
                        <br />
                        JOIN US?
                    </h1>
                    <p className="mt-4 text-xl font-bold tracking-tight text-red md:text-2xl">
                        RANKED. RESPECTED. RELENTLESS.
                    </p>
                    <p className="mx-auto mt-4 max-w-xl text-sm text-black/70 md:text-base">
                        Quarterfinalists at DD Robocon 2026 - out by 4 seconds on a
                        tiebreak. Ranked 5th of 110+ teams nationally in 2026.
                    </p>

                    <button
                        onClick={() => router.push("/recruit/register")}
                        rel="noopener noreferrer"
                        className="group relative mt-8 inline-flex items-center justify-center overflow-hidden bg-red px-10 py-3 font-bold text-white shadow-lg shadow-red/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97]"
                        style={{ clipPath: "polygon(12% 0%, 100% 0%, 88% 100%, 0% 100%)" }}
                    >
                        <span
                            className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                            style={{
                                clipPath: "polygon(12% 0%, 100% 0%, 88% 100%, 0% 100%)",
                                backgroundColor: "#D4AF37",
                            }}
                        />
                        <span className="relative transition-colors duration-200 group-hover:text-black">
                            Register
                        </span>
                    </button>
                </div>

                {/* Tagline */}
                <div className="w-full max-w-full overflow-hidden border-y-2 border-black/10 py-8 text-center">
                    <div
                        className="break-words text-[clamp(2.2rem,8vw,4.5rem)] font-bold uppercase leading-none tracking-normal"
                        style={{ color: "#D4AF37" }}
                    >
                        Make. Break. Innovate.
                    </div>
                    <div
                        className="mt-2 break-words text-[clamp(2rem,7vw,4.5rem)] font-bold uppercase leading-none tracking-normal"
                        style={{ color: "#D4AF37" }}
                    >
                       DD ROBOCON 2026 AIR 5
                    </div>
                </div>

                {/* Domains */}
                <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
                    {domains.map((domain) => (
                        <div
                            key={domain.acronym}
                            className="min-w-0 border-2 border-red bg-black p-5"
                        >
                            <h3 className="break-words text-lg font-bold tracking-tight text-white md:text-xl">
                                {domain.acronym}
                            </h3>
                            <p className="mt-1 break-words text-[11px] font-semibold uppercase tracking-wide text-red">
                                {domain.full}
                            </p>
                            <p className="mt-3 break-words text-sm text-white/70">{domain.blurb}</p>
                        </div>
                    ))}
                </div>

                {/* Game highlight videos */}
                <div className="w-full">
                    <div className="flex gap-4 overflow-x-auto pb-2 md:justify-center">
                        {recruitmentVideos.map((video) => (
                            <div
                                key={video.id}
                                className="w-[300px] shrink-0 border-2 border-red bg-black md:w-[360px]"
                            >
                                <div className="relative w-full pt-[56.25%]">
                                    <iframe
                                        className="absolute inset-0 h-full w-full"
                                        src={`https://www.youtube.com/embed/${video.id}`}
                                        title={video.title}
                                        loading="lazy"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        referrerPolicy="strict-origin-when-cross-origin"
                                        allowFullScreen
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ask a Doubt — inline chatbot, sharp red/white/black to match the
                    rest of this section rather than the dashboard's dark glass theme.
                    Public endpoint (/api/recruit/public-chat): works for visitors who
                    haven't registered yet. */}
                <div className="w-full max-w-xl">
                    <InlineChatWidget />
                </div>
            </div>
        </section>
    );
};

export default RecruitmentSection;
