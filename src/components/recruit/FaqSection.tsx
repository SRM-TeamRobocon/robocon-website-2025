"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import GlassCard from "@/components/recruit/GlassCard";

type FaqRow = {
    id: string;
    question: string;
    answer: string;
    display_order: number;
    is_published: boolean;
};

export default function FaqSection() {
    const [faqs, setFaqs] = useState<FaqRow[]>([]);
    const [openId, setOpenId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        fetch("/api/content/faq")
            .then((res) => res.json())
            .then((json) => {
                if (cancelled) return;
                const rows: FaqRow[] = Array.isArray(json?.data) ? json.data : [];
                const published = rows
                    .filter((row) => row.is_published)
                    .sort((a, b) => a.display_order - b.display_order);
                setFaqs(published);
            })
            .catch(() => {
                // Non-essential section — the rest of the dashboard still works without it.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (faqs.length === 0) return null;

    return (
        <GlassCard contentClassName="p-6 md:p-8" borderRadius={28}>
            <p className="font-mono text-xs uppercase tracking-widest text-white/40 mb-4">// faq</p>
            <div className="space-y-2">
                {faqs.map((faq) => {
                    const isOpen = openId === faq.id;
                    return (
                        <div key={faq.id} className="border border-white/10 rounded-xl bg-white/5 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setOpenId(isOpen ? null : faq.id)}
                                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                            >
                                <span className="text-sm font-bold text-white/80">{faq.question}</span>
                                <ChevronDown
                                    className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${
                                        isOpen ? "rotate-180" : ""
                                    }`}
                                />
                            </button>
                            {isOpen && (
                                <div className="px-4 pb-4 text-sm text-white/60 whitespace-pre-wrap">
                                    {faq.answer}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </GlassCard>
    );
}
