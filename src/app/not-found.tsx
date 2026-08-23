import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
    return (
        <div className="min-h-[100dvh] flex items-center justify-center relative z-10 p-5 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 w-full max-w-3xl flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
                <Image
                    src="/404/404.png"
                    alt=""
                    width={433}
                    height={577}
                    unoptimized
                    priority
                    className="w-40 sm:w-56 h-auto object-contain select-none order-2 sm:order-1"
                />

                <div className="text-center sm:text-left order-1 sm:order-2">
                    <h1 className="text-7xl sm:text-8xl font-bold tracking-tight text-white leading-none">
                        4<span className="text-red">0</span>4
                    </h1>
                    <h2 className="mt-3 text-xl sm:text-2xl font-bold text-white">
                        Page not found
                    </h2>
                    <p className="mt-2 text-sm text-gray-400 max-w-xs mx-auto sm:mx-0">
                        Even our robots couldn&apos;t locate this page. It may have been moved or never existed.
                    </p>

                    <Link
                        href="/"
                        className="group relative mt-6 inline-flex items-center justify-center overflow-hidden px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] bg-red"
                        style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                    >
                        <span
                            className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                            style={{
                                clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
                                backgroundColor: "#D4AF37",
                            }}
                        />
                        <span className="relative z-10 transition-colors duration-200 group-hover:text-black">
                            Back to home
                        </span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
