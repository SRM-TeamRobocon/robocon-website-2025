/* eslint-disable @next/next/no-img-element */
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
// import { BiDownload } from "react-icons/bi";

const HackathonSection = () => {
    const router = useRouter();
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const eventDate = new Date("2025-10-29T23:59:59+05:30"); // 30th Oct 2025, 11:59:59 PM IST
        const updateTimeLeft = () => {
            const now = new Date();
            const diff = eventDate.getTime() - now.getTime();
            if (diff <= 0) {
                setTimeLeft("Event Ended");
                return;
            }
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / (1000 * 60)) % 60);
            const seconds = Math.floor((diff / 1000) % 60);
            setTimeLeft(`${days} days ${hours} hrs ${minutes} mins ${seconds} secs`);
        };
        updateTimeLeft();
        const interval = setInterval(updateTimeLeft, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <section className="relative flex flex-col-reverse md:flex-row justify-between w-full h-auto min-h-screen md:bg-[url(/events/spiderman-bg.png)] bg-cover bg-center overflow-hidden">

            <div className="lg:hidden md:w-1/2 z-10 md:flex md:justify-center ">
                <img
                    src="/events/hackathon.jpg"
                    alt="Poster"
                    className="max-w-full h-[600px] object-contain"
                />
            </div>
            <div className="[@media(max-width:900px)]:hidden p-10 pr-20 h-min relative top-0 w-full flex flex-col justify-top items-end z-50">
                <span className="text-[#ffffff] lg:text-5xl z-100 pt-6 md:text-4xl font-bold">
                    31t Oct 2025
                    </span>
            <span className="text-[#477ec2] text-2xl font-bold"><span className="text-white">Closes in : </span>{timeLeft}</span><button
                onClick={()=>window.location.href='https://str-idea-verse.devpost.com/?fbclid=PAZXh0bgNhZW0CMTEAAae1Iclwy05UIW7unF5m14ij6vNg2VsVgq-DJ9SNBSO_JazmAvpugd1d287XxA_aem_96NFc4pvhEVdk8uVfP-S8A'}
                rel="noopener noreferrer"
                className= "bg-[#ff0505] hover:bg-slate-900 hover:text-white text-white font-bold py-3 px-6"
            >
                Register
            </button>
            </div>

            <div className="lg:hidden w-full md:w-1/2 flex flex-col items-center justify-center p-8 text-center bg-[#97979780]">
                <h1 className="text-[#ffffff] text-3xl pt-6 md:text-6xl font-bold">
                    SOLSTICE Ideathon
                </h1>
                <h3 className="text-[#ffffff] text-1xl pt-6 md:text-1xl font-bold">
                    Registrations Open!
                </h3>
                <span className="text-[#ffffff] lg:text-5xl z-100 pt-6 text-3xl font-bold">
                    31t Oct 2025
                </span>
                <span className="text-2xl md:text-4xl font-bold text-[#ff2f2f]"><span className="text-white">Closes in : </span>{timeLeft}</span>
                <div className="flex justify-center">
                <button
                    onClick={()=>window.location.href='https://str-idea-verse.devpost.com/?fbclid=PAZXh0bgNhZW0CMTEAAae1Iclwy05UIW7unF5m14ij6vNg2VsVgq-DJ9SNBSO_JazmAvpugd1d287XxA_aem_96NFc4pvhEVdk8uVfP-S8A'}
                    rel="noopener noreferrer"
                    className="lg:hidden mt-3 mb-8 z-10 bg-[#4fb3ff] hover:bg-slate-900 hover:text-white text-black font-bold py-3 px-6 flex flex-row items-center justify-center"
                >
                    <span className="ml-1">Register</span>
                </button>
                </div>

            </div>
        </section>
    );
};

export default HackathonSection;
