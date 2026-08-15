"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import GlassCard from "./recruit/GlassCard";
// import { BiDownload } from "react-icons/bi";

const RecruitmentSection = () => {
    const router = useRouter();
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

    return (
        <section className="relative isolate flex flex-col items-center justify-center w-full h-auto min-h-screen overflow-hidden gap-8 md:gap-10 px-4 md:px-8 py-10 md:py-16">
            {/* Self-contained, translucent backdrop — kept see-through so the global
                <ParticlesCom /> canvas behind the page shows through here too.
                Do NOT use the global .robocon-theme-bg class: its ::before/::after are
                `position: fixed; inset: 0`, which is meant for a page root (see
                /attendance). On this mid-page section they blanket the whole viewport
                and paint over everything above, including the homepage hero. */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.75)_100%)]" />

            {/* Registration isn't open yet — hide the CTA until it is.
            <button
                onClick={() => router.push("/recruit/register")}
                rel="noopener noreferrer"
                className="mt-8 mb-8 z-10 bg-red md:hidden hover:bg-red/90 active:scale-[0.97] text-white font-bold py-3 px-6 rounded-full flex items-center justify-center transition-all duration-150 shadow-lg shadow-red/20"
            >
                Register
                <span className="ml-1">Register</span>
                <BiDownload className="w-5 h-5" />
            </button>
            */}

            {/* <div className="w-full md:w-1/2 z-10 flex justify-center ">
                <img
                    src="/events/poster.png"
                    alt="Poster"
                    className="max-w-full h-[600px] rounded-md object-contain"
                />
            </div> */}

            <div className="z-10 w-full flex items-center justify-center p-4 md:p-8">
                <div className="w-full max-w-md mx-auto">
                    <GlassCard contentClassName="p-8 text-center" borderRadius={4}>
                        <h1 className="text-white text-4xl z-10 md:text-6xl font-bold tracking-tight leading-[1.05]">
                            DARE TO JOIN US?
                        </h1>
                        {/* <h3 className="text-white/60 text-xl z-10 pt-4 md:text-2xl font-bold">
                           Applications Opening Soon!
                        </h3>
                        <h3 className="text-white/60 text-sm z-10 pt-4 md:text-base font-bold">
                           Keep an eye on our <a href="https://www.instagram.com/srmteamrobocon/" target="_blank" rel="noopener noreferrer" className="text-red underline">Instagram</a> for more information!
                        </h3> */}

                        {/* Registration isn't open yet — hide the CTA until it is. */}
                        <button
                            onClick={() => router.push("/recruit/register")}
                            rel="noopener noreferrer"
                            className="mt-8 z-10 bg-red hover:bg-red/90 active:scale-[0.97] text-white font-bold py-3 px-6 rounded-full items-center justify-center inline-flex transition-all duration-150 shadow-lg shadow-red/20"
                        >
                            <span className="ml-1">Register</span>
                            {/* <BiDownload className="w-5 h-5" /> */}
                        </button>
                       
                    </GlassCard>
                </div>
            </div>

            <div className="z-10 w-full max-w-6xl px-1 md:px-2">
                <div className="flex gap-4 overflow-x-auto pb-2 md:justify-center">
                    {recruitmentVideos.map((video) => (
                        <div
                            key={video.id}
                            className="w-[300px] md:w-[360px] shrink-0 overflow-hidden border border-white/20 bg-black/30"
                            style={{ clipPath: "polygon(4% 0%,100% 0%,96% 100%,0% 100%)" }}
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

        </section>
    );
};

export default RecruitmentSection;
