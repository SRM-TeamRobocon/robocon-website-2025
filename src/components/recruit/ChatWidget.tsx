"use client";

import { useRef, useState, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

// Renders message text with any http(s) URLs turned into clickable links — the RAG
// answer's Instagram fallback (see src/lib/rag/answer.ts) includes a raw URL that would
// otherwise render as inert plain text.
function renderMessageContent(content: string, linkClassName: string) {
    // A regex with a capturing group makes split() interleave the captured URLs into
    // the result array at odd indices — no separate .test()/.exec() call needed (and no
    // shared-regex lastIndex statefulness to worry about, since split() doesn't use it).
    const parts = content.split(URL_PATTERN);
    return parts.map((part, i) =>
        i % 2 === 1 ? (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={linkClassName}>
                {part}
            </a>
        ) : (
            part
        )
    );
}

// Shared fetch/state logic for both chat surfaces — the floating dark-glass widget on
// /recruit/dashboard (authenticated, /api/recruit/chat) and the inline light widget on
// the homepage RecruitmentSection (public, /api/recruit/public-chat). Only the endpoint
// and the JSX around it differ.
function useDoubtChat(endpoint: string) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, busy]);

    const send = async () => {
        const text = input.trim();
        if (!text || busy) return;

        setMessages((prev) => [...prev, { role: "user", content: text }]);
        setInput("");
        setBusy(true);

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text }),
            });
            const json = await res.json();
            if (res.ok && json.success) {
                setMessages((prev) => [...prev, { role: "assistant", content: json.answer }]);
            } else {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: json.error || "Something went wrong — try again in a moment." },
                ]);
            }
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Network error — try again in a moment." },
            ]);
        } finally {
            setBusy(false);
        }
    };

    return { messages, input, setInput, busy, send, scrollRef };
}

// Floating dark-glass widget — unchanged behaviour, used on /recruit/dashboard.
export default function ChatWidget() {
    const [open, setOpen] = useState(false);
    const { messages, input, setInput, busy, send, scrollRef } = useDoubtChat("/api/recruit/chat");

    return (
        <>
            {open && (
                <div className="fixed bottom-24 right-6 z-50 w-[calc(100vw-3rem)] max-w-sm h-[28rem] flex flex-col rounded-2xl border border-white/15 bg-[#0a0a0d]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <p className="font-mono text-xs uppercase tracking-widest text-white/60">Ask a Doubt</p>
                        <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white transition">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                        {messages.length === 0 && (
                            <p className="text-sm text-white/40 font-mono">
                                Ask anything about recruitment — I can only answer from what the team has shared here.
                            </p>
                        )}
                        {messages.map((m, i) => (
                            <div
                                key={i}
                                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                                    m.role === "user"
                                        ? "ml-auto bg-red/20 text-white"
                                        : "bg-white/10 text-white/80"
                                }`}
                            >
                                {renderMessageContent(m.content, "underline text-red-300 hover:text-red-200 break-all")}
                            </div>
                        ))}
                        {busy && (
                            <div className="bg-white/10 text-white/50 rounded-xl px-3 py-2 text-sm w-fit font-mono">
                                thinking...
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 p-3 border-t border-white/10">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && send()}
                            placeholder="Type your question..."
                            disabled={busy}
                            className="flex-1 rounded-lg border-0 bg-white/5 py-2 px-3 text-sm text-white placeholder:text-white/30 ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red/50 disabled:opacity-50"
                        />
                        <button
                            onClick={send}
                            disabled={busy || !input.trim()}
                            className="shrink-0 rounded-lg bg-red/20 p-2 text-red transition hover:bg-red/30 disabled:opacity-40"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            <button
                onClick={() => setOpen((o) => !o)}
                className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-red text-white shadow-lg shadow-red/30 transition hover:scale-105 active:scale-95"
                aria-label="Ask a doubt"
            >
                {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
            </button>
        </>
    );
}

// Inline sharp red/white/black widget — always-open card matching RecruitmentSection's
// poster aesthetic (angled clip-path corner, black border, no glass/blur). Public
// endpoint: no recruit_token, works for homepage visitors who haven't registered yet.
export function InlineChatWidget() {
    const { messages, input, setInput, busy, send, scrollRef } = useDoubtChat("/api/recruit/public-chat");

    return (
        <div
            className="w-full border-2 border-black bg-white"
            style={{ clipPath: "polygon(0 0,100% 0,100% 96%,96% 100%,0 100%)" }}
        >
            <div className="flex items-center gap-2 border-b-2 border-black px-5 py-3">
                <MessageCircle className="h-4 w-4 text-red" strokeWidth={2.5} />
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-black">Ask a Doubt</p>
            </div>

            <div ref={scrollRef} className="h-64 overflow-y-auto px-5 py-4 space-y-3">
                {messages.length === 0 && (
                    <p className="text-sm text-black/50">
                        Got a question about recruitment? Ask here — answers come only from what the team has shared.
                    </p>
                )}
                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap ${
                            m.role === "user"
                                ? "ml-auto bg-red text-white"
                                : "border border-black/15 bg-black/[0.03] text-black/80"
                        }`}
                    >
                        {renderMessageContent(m.content, "underline text-red hover:text-red/80 break-all font-semibold")}
                    </div>
                ))}
                {busy && (
                    <div className="border border-black/15 bg-black/[0.03] text-black/40 px-3 py-2 text-sm w-fit">
                        thinking...
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 border-t-2 border-black p-3">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Type your question..."
                    disabled={busy}
                    className="flex-1 border border-black/20 bg-white py-2 px-3 text-sm text-black placeholder:text-black/30 focus:outline-none focus:border-red disabled:opacity-50"
                />
                <button
                    onClick={send}
                    disabled={busy || !input.trim()}
                    className="shrink-0 bg-red p-2 text-white transition hover:bg-red/90 disabled:opacity-40"
                    aria-label="Send"
                >
                    <Send className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
