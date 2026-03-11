"use client";

import Image from "next/image";
import Link from "next/link";

const workshops = [
    {
        title: "SolidWorks Workshop",
        tag: "CAD Modelling",
        date: "Mar 11–13",
        image: "/events/solidworks2026.png",
        link: "/workshopReg2",
        isClosed: true,
    },
    {
        title: "Altium Workshop",
        tag: "PCB Design",
        date: "Mar 11–13",
        image: "/events/altium2026.png",
        link: "/workshopReg2",
        isClosed: false,
    },
];

const WorkshopSection = () => {
    return (
        <section className="relative w-full py-20 md:py-28">
            <div className="relative z-10 mx-auto px-6 md:px-16 max-w-6xl">
                {/* Section Header */}
                <div className="text-center mb-10 md:mb-14">
                    <p className="text-red font-semibold tracking-widest uppercase text-sm mb-3">
                        Learn &bull; Build &bull; Innovate
                    </p>
                    <h2 className="text-4xl md:text-5xl font-bold text-white">
                        Upcoming Workshops
                    </h2>
                </div>

                {/* Poster Cards */}
                <div className="flex flex-col md:flex-row gap-8 md:gap-10 items-center justify-center">
                    {workshops.map((workshop, index) => (
                        <div
                            key={index}
                            className="group relative w-full max-w-[360px]"
                        >
                            {/* Red glow behind card on hover */}
                            <div className="absolute -inset-1 bg-gradient-to-b from-red/0 via-red/20 to-red/0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />

                            <div className="relative rounded-2xl overflow-hidden bg-[#111] border border-white/[0.08] group-hover:border-red/30 transition-all duration-400">
                                {/* Tag Badge */}
                                <div className="absolute top-4 left-4 z-20">
                                    <span className="bg-red/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                                        {workshop.tag}
                                    </span>
                                </div>

                                {/* Date Badge */}
                                <div className="absolute top-4 right-4 z-20">
                                    <span className="bg-black/70 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20">
                                        {workshop.date}
                                    </span>
                                </div>

                                {/* Poster Image */}
                                <div className="relative w-full aspect-[3/4] overflow-hidden">
                                    <Image
                                        src={workshop.image}
                                        alt={workshop.title}
                                        fill
                                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                                        unoptimized
                                    />
                                    {/* Bottom fade */}
                                    <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#111] to-transparent" />
                                </div>

                                {/* Bottom Content */}
                                <div className="relative px-5 pb-5 -mt-8 z-10">
                                    <h3 className="text-xl font-bold text-white mb-3">
                                        {workshop.title}
                                    </h3>
                                    {workshop.isClosed ? (
                                        <button
                                            disabled
                                            className="flex items-center justify-center gap-2 w-full bg-white/[0.05] border border-white/10 text-white/50 font-semibold py-2.5 rounded-lg text-sm cursor-not-allowed"
                                        >
                                            Registrations Closed
                                        </button>
                                    ) : (
                                        <Link
                                            href={workshop.link || "/workshopReg2"}
                                            className="flex items-center justify-center gap-2 w-full bg-white/[0.09] hover:bg-red border border-white/10 hover:border-red text-white font-semibold py-2.5 rounded-lg text-sm transition-all duration-300"
                                        >
                                            Register Now
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="w-4 h-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2.5}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                                                />
                                            </svg>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default WorkshopSection;
