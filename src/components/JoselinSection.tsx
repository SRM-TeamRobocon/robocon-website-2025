/* eslint-disable @next/next/no-img-element */
import { useEffect } from "react";
import Image from "next/image";
import LinkedinBoxFillIcon from "remixicon-react/LinkedinBoxFillIcon";
import Link from "next/link";
import AOS from "aos";

const JoselinSection = () => {
    useEffect(() => {
        AOS.init({
            duration: 800,
            once: false,
        });
    }, []);

    return (
        <section className="relative w-full min-h-screen py-20">
            <div className="relative z-10 mx-auto px-8 md:px-16">
                {/* Main Heading */}
                <h1
                    data-aos="fade-down"
                    className="text-white text-5xl md:text-6xl font-bold text-center mb-16"
                >
                    Our Faculty Advisor
                </h1>

                {/* Content Container */}
                <div className="joselin-container flex items-center justify-center gap-12 md:gap-16">
                    {/* Info Section */}
                    <div
                        data-aos="fade-right"
                        className="flex-1 text-white max-w-2xl"
                    >
                        <h2 className="text-4xl md:text-5xl font-bold mb-2 text-gray-200">
                            Mr. Joselin Retna Kumar
                        </h2>
                        <p className="text-red font-bold mb-6">
                            Head of Department, EIE (Electronics and Instrumentation Engineering)
                        </p>

                        {/* White Line Divider */}
                        <div className="w-full h-px bg-white mb-5"></div>

                        {/* Description Text */}
                        <div className="space-y-4 mb-8 text-gray-200 opacity-70 leading-relaxed">
                            <p>
                                Seeing the SRM Team Robocon grow has been one of the most rewarding parts of my role at SRM IST. I firmly believe that competitive robotics is not just about engineering machines, but about nurturing problem-solving, creativity, and teamwork among our students. Over the years, I’ve witnessed our team take on challenging problem statements, push technical boundaries from CAD design to PCB development, and translate theory into innovative robots with precision and purpose. Every workshop we conduct be it in SolidWorks, PCB design, or hands-on training reinforces my conviction that experiential learning empowers our students with industry-relevant skills. Their dedication and resilience, especially during competitions like DD Robocon, reflect the spirit of innovation and collaboration that defines SRM Team Robocon
                            </p>
                        </div>



                        {/* LinkedIn Link */}
                        {/* <div className="flex items-center gap-4">
                            <span className="text-lg font-semibold">Connect on LinkedIn:</span>
                            <Link
                                href="https://www.linkedin.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-red hover:bg-red/80 text-white font-bold py-3 px-6 transition duration-300 flex items-center gap-2"
                            >
                                <LinkedinBoxFillIcon size={24} />
                                LinkedIn
                            </Link>
                        </div> */}
                    </div>

                    {/* Photo Section */}
                    <div
                        data-aos="slide-left"
                        className="joselin-photo flex-shrink-0"
                    >
                        <div className="relative w-[700px] h-100 flex items-center justify-center overflow-hidden hero-clip2">
                            <Image
                                src="/joselin.png"
                                alt="Mr. Joselin Retna Kumar"
                                width={400}
                                height={650}
                                className="object-cover w-full h-full"
                                unoptimized
                            />
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default JoselinSection;
