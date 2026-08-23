"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X, Send } from "lucide-react";
import { recruitFetch } from "@/lib/recruit-fetch-client";

type ChatMessage = { role: "user" | "assistant"; content: string };

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

// A `border` doesn't render along a clip-path's angled edge (and a `::before` pseudo with
// a negative z-index doesn't work either — it still paints on top of this element's own
// background, just below its children, so it blacks out any part of the card without its
// own opaque content). The light-theme panels below simulate their border with two nested
// elements instead: an outer one filled with the border color and padded by the border
// width, and an inner one with the real fill.
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
function useDoubtChat(endpoint: string, onUnauthorized?: () => void) {
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
            const res = await recruitFetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text }),
            });
            if (res.status === 401 && onUnauthorized) {
                // Session expired mid-conversation — the raw "Unauthorized access" /
                // "Not authenticated" body is a dead end here (see TicketsSection's
                // identical 401 handling), so bounce to login instead of leaving the
                // widget stuck on an error the recruit can't act on.
                onUnauthorized();
                return;
            }
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

// Floating widget — used on /recruit/dashboard. `theme` defaults to the original
// dark-glass look so every other call site (there was only ever this one, but the
// default keeps it that way if that changes) is unaffected; the dashboard now passes
// theme="light" to match its sharp red/white/black reskin instead of floating dark
// glass over a white page.
export default function ChatWidget({ theme = "dark" }: { theme?: "dark" | "light" }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const { messages, input, setInput, busy, send, scrollRef } = useDoubtChat("/api/recruit/chat", () =>
        router.push("/recruit/login")
    );
    const light = theme === "light";

    return (
        <>
            {open && (
                <div
                    className={
                        light
                            ? "fixed bottom-24 right-6 z-50 w-[calc(100vw-3rem)] max-w-sm h-[28rem] bg-black p-[2px]"
                            : "fixed bottom-24 right-6 z-50 w-[calc(100vw-3rem)] max-w-sm h-[28rem]"
                    }
                >
                <div
                    className={
                        light
                            ? "flex h-full w-full flex-col bg-white shadow-2xl"
                            : "flex flex-col h-full rounded-2xl border border-white/15 bg-[#0a0a0d]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                    }
                >
                    <div
                        className={
                            light
                                ? "flex items-center justify-between px-4 py-3 border-b-2 border-black"
                                : "flex items-center justify-between px-4 py-3 border-b border-white/10"
                        }
                    >
                        <p
                            className={
                                light
                                    ? "font-mono text-xs uppercase tracking-widest text-black/60"
                                    : "font-mono text-xs uppercase tracking-widest text-white/60"
                            }
                        >
                            Ask a Doubt
                        </p>
                        <button
                            onClick={() => setOpen(false)}
                            className={light ? "text-black/40 hover:text-black transition" : "text-white/40 hover:text-white transition"}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                        {messages.length === 0 && (
                            <p className={light ? "text-sm text-black/50" : "text-sm text-white/40 font-mono"}>
                                Ask anything about recruitment — I can only answer from what the team has shared here.
                            </p>
                        )}
                        {messages.map((m, i) => (
                            <div
                                key={i}
                                className={
                                    light
                                        ? `max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap ${
                                              m.role === "user"
                                                  ? "ml-auto bg-red text-white"
                                                  : "border border-black/15 bg-black/[0.03] text-black/80"
                                          }`
                                        : `max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                                              m.role === "user"
                                                  ? "ml-auto bg-red/20 text-white"
                                                  : "bg-white/10 text-white/80"
                                          }`
                                }
                            >
                                {renderMessageContent(
                                    m.content,
                                    light
                                        ? "underline text-red hover:text-red/80 break-all font-semibold"
                                        : "underline text-red-300 hover:text-red-200 break-all"
                                )}
                            </div>
                        ))}
                        {busy && (
                            <div
                                className={
                                    light
                                        ? "border border-black/15 bg-black/[0.03] text-black/40 px-3 py-2 text-sm w-fit"
                                        : "bg-white/10 text-white/50 rounded-xl px-3 py-2 text-sm w-fit font-mono"
                                }
                            >
                                thinking...
                            </div>
                        )}
                    </div>

                    <div
                        className={
                            light
                                ? "flex items-center gap-2 p-3 border-t-2 border-black"
                                : "flex items-center gap-2 p-3 border-t border-white/10"
                        }
                    >
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && send()}
                            placeholder="Type your question..."
                            disabled={busy}
                            className={
                                light
                                    ? "flex-1 border border-black/20 bg-white py-2 px-3 text-sm text-black placeholder:text-black/30 focus:outline-none focus:border-red disabled:opacity-50"
                                    : "flex-1 rounded-lg border-0 bg-white/5 py-2 px-3 text-sm text-white placeholder:text-white/30 ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red/50 disabled:opacity-50"
                            }
                        />
                        <button
                            onClick={send}
                            disabled={busy || !input.trim()}
                            className={
                                light
                                    ? "shrink-0 bg-red p-2 text-white transition hover:bg-red/90 disabled:opacity-40"
                                    : "shrink-0 rounded-lg bg-red/20 p-2 text-red transition hover:bg-red/30 disabled:opacity-40"
                            }
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
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
// poster aesthetic (black border, no glass/blur). Public
// endpoint: no recruit_token, works for homepage visitors who haven't registered yet.
export function InlineChatWidget() {
    const { messages, input, setInput, busy, send, scrollRef } = useDoubtChat("/api/recruit/public-chat");

    return (
        <div className="w-full border-2 border-black bg-white">
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
