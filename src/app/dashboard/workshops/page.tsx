"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import { Users, Clock3, ShieldCheck, ScanLine, QrCode, ArrowUpRight, Wrench } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";

interface Metric {
    total: number;
    pending: number;
    verified: number;
    checkedIn: number;
}

const STAT_CARDS = [
    { key: "total", label: "Total Registrations", icon: Users, tone: "text-white", border: "border-white/10" },
    { key: "pending", label: "Pending Payment", icon: Clock3, tone: "text-amber-400", border: "border-amber-500/30" },
    { key: "verified", label: "Verified", icon: ShieldCheck, tone: "text-emerald-400", border: "border-emerald-500/30" },
    { key: "checkedIn", label: "Checked In", icon: ScanLine, tone: "text-blue-400", border: "border-blue-500/30" },
] as const;

export default function WorkshopsPage() {
    const ready = useRequireRole(["lead", "admin"]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Metric>({ total: 0, pending: 0, verified: 0, checkedIn: 0 });

    useEffect(() => {
        fetch("/api/admin/registrations")
            .then((res) => res.json())
            .then((json) => {
                if (json.success && json.data) {
                    const data: any[] = json.data;
                    setStats({
                        total: data.length,
                        pending: data.filter((r) => r.paymentStatus === "PENDING").length,
                        verified: data.filter((r) => r.paymentStatus === "VERIFIED").length,
                        checkedIn: data.filter((r) => r.attendance === "PRESENT").length,
                    });
                }
            })
            .catch((error) => console.error("Failed to fetch workshop stats", error))
            .finally(() => setLoading(false));
    }, []);

    if (!ready) return null;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Wrench className="w-7 h-7 text-red" />
                    Workshops
                </h1>
                <p className="mt-2 text-gray-400 max-w-xl text-sm">
                    Registrations, payment verification, and check-in for workshop events.
                </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {STAT_CARDS.map((card, i) => {
                    const Icon = card.icon;
                    const value = stats[card.key];
                    return (
                        <motion.div
                            key={card.key}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
                            className={`border ${card.border} bg-black backdrop-blur-xl p-4 sm:p-5 transition-colors`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-gray-500">
                                    {card.label}
                                </span>
                                <Icon className={`w-4 h-4 ${card.tone} opacity-70`} />
                            </div>
                            <div className={`mt-3 text-2xl sm:text-3xl font-black ${card.tone}`}>
                                {loading ? (
                                    <span className="inline-block h-8 w-12 bg-white/5 animate-pulse" />
                                ) : (
                                    <CountUp end={value} duration={1.1} />
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <Link href="/scanner" className="group block">
                <div className="relative border border-emerald-500/30 bg-black hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] p-6 sm:p-7 transition-all hover:scale-[1.01]">
                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
                        <QrCode className="w-20 h-20 text-emerald-400" strokeWidth={1} />
                    </div>
                    <div className="relative z-10">
                        <span className="inline-flex w-fit items-center gap-1.5 px-3 py-1 text-xs font-bold mb-4 ring-1 ring-inset bg-emerald-500/20 text-emerald-400 ring-emerald-500/30">
                            Live Check-in
                        </span>
                        <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">Scanner</h3>
                        <p className="text-gray-300 mb-6 text-sm leading-relaxed">
                            Scan attendee QR codes for fast, on-the-spot check-in.
                        </p>
                        <div className="flex items-center text-sm font-medium text-gray-300 group-hover:text-emerald-400">
                            Open
                            <ArrowUpRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    );
}
