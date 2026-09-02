"use client";

// A lightweight CSS-only lanyard: a strap (glossy) + clip + card hang together as one
// pendulum, idly swaying on its own. Not pointer-interactive - it doesn't tilt or
// respond to hover/drag. A plain click opens the badge full-size, since that's how
// recruits actually read their QR code clearly.
import { useState } from "react";
import { createPortal } from "react-dom";

interface LanyardBadgeProps {
    badgeImage: string; // data URL from generateBadgeImage - logo + name + QR
    className?: string;
}

export default function LanyardBadge({ badgeImage, className = "" }: LanyardBadgeProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`lanyard-badge-scene ${className}`}>
            {/* Strap, clip, and card all live inside one swaying pendulum so they move
                together as a single rigid body, pivoting from the top. */}
            <div className="lanyard-badge-pendulum" onClick={() => setExpanded(true)}>
                <div className="lanyard-badge-strap">
                    {[18, 50, 82].map((top) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            key={top}
                            src="/LOGO.png"
                            alt=""
                            className="lanyard-badge-strap-logo"
                            style={{ top: `${top}%` }}
                            draggable={false}
                        />
                    ))}
                </div>
                <div className="lanyard-badge-clip" />
                <div className="lanyard-badge-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={badgeImage} alt="Your recruitment badge" draggable={false} />
                </div>
            </div>

            {expanded &&
                typeof document !== "undefined" &&
                createPortal(
                    <div className="lanyard-badge-overlay" onClick={() => setExpanded(false)}>
                        <button
                            type="button"
                            className="lanyard-badge-overlay-close"
                            onClick={(e) => {
                                e.stopPropagation();
                                setExpanded(false);
                            }}
                            aria-label="Close"
                        >
                            &times;
                        </button>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={badgeImage}
                            alt="Your recruitment badge, enlarged"
                            className="lanyard-badge-overlay-img"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>,
                    document.body
                )}

            <style jsx>{`
                .lanyard-badge-scene {
                    --lb-w: min(300px, 74vw);
                    position: relative;
                    width: 100%;
                    display: flex;
                    justify-content: center;
                    /* Both axes must be non-"visible" together: per the CSS overflow spec, a
                       lone overflow-y: visible next to overflow-x: hidden computes to auto,
                       not visible - and since the pendulum's rotate() transform continuously
                       changes its scrollable-overflow bounds via the idle sway animation,
                       that auto toggled a real scrollbar in and out on every cycle. The
                       swing's vertical extent barely changes at these angles, so clipping it
                       here is imperceptible. */
                    overflow: hidden;
                    padding-top: 12px;
                }
                .lanyard-badge-pendulum {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    transform-origin: top center;
                    animation: lanyard-sway 4.5s ease-in-out infinite;
                    cursor: pointer;
                }
                .lanyard-badge-strap {
                    position: relative;
                    width: 52px;
                    /* Scales with the card so the whole assembly grows/shrinks together
                       instead of drifting apart like the old vh-based height did. Shorter
                       ratio than before - the strap was dominating the composition with
                       empty space above a comparatively small card. */
                    height: calc(var(--lb-w) * 1);
                    min-height: 200px;
                    max-height: 320px;
                    background: linear-gradient(
                        90deg,
                        #c7c7cd 0%,
                        #f7f7f9 15%,
                        #ffffff 32%,
                        #d4d4da 50%,
                        #ffffff 68%,
                        #eeeef1 85%,
                        #c2c2c8 100%
                    );
                    border-radius: 6px;
                    box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.18), 0 2px 10px rgba(0, 0, 0, 0.35);
                    overflow: hidden;
                }
                .lanyard-badge-strap::before {
                    content: "";
                    position: absolute;
                    inset: -30% -80%;
                    background: linear-gradient(
                        100deg,
                        transparent 38%,
                        rgba(90, 90, 105, 0.22) 46%,
                        rgba(255, 255, 255, 0.95) 50%,
                        rgba(90, 90, 105, 0.22) 54%,
                        transparent 62%
                    );
                    animation: lanyard-sheen 4.5s ease-in-out infinite;
                }
                .lanyard-badge-strap-logo {
                    position: absolute;
                    left: 50%;
                    width: 46px;
                    height: 46px;
                    transform: translate(-50%, -50%);
                    object-fit: contain;
                    opacity: 0.95;
                    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
                }
                .lanyard-badge-clip {
                    width: 26px;
                    height: 16px;
                    margin-top: -2px;
                    background: linear-gradient(180deg, #9ca3af, #4b5563);
                    border-radius: 4px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
                }
                .lanyard-badge-card {
                    margin-top: 6px;
                    width: var(--lb-w);
                    aspect-ratio: 640 / 964;
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08);
                }
                .lanyard-badge-card img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                    pointer-events: none;
                }
                @keyframes lanyard-sway {
                    0%,
                    100% {
                        transform: rotate(-3deg);
                    }
                    50% {
                        transform: rotate(3deg);
                    }
                }
                @keyframes lanyard-sheen {
                    0% {
                        transform: translateY(-55%);
                    }
                    100% {
                        transform: translateY(55%);
                    }
                }
            `}</style>
            <style jsx global>{`
                .lanyard-badge-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(5, 5, 8, 0.92);
                    backdrop-filter: blur(4px);
                    cursor: zoom-out;
                    padding: 24px;
                    animation: lanyard-overlay-in 0.15s ease-out;
                }
                .lanyard-badge-overlay-img {
                    max-height: 92vh;
                    max-width: 92vw;
                    width: auto;
                    height: auto;
                    border-radius: 20px;
                    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7);
                    cursor: default;
                }
                .lanyard-badge-overlay-close {
                    position: fixed;
                    top: 20px;
                    right: 24px;
                    width: 44px;
                    height: 44px;
                    border-radius: 9999px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: rgba(255, 255, 255, 0.08);
                    color: #fff;
                    font-size: 28px;
                    line-height: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: background-color 0.15s ease;
                }
                .lanyard-badge-overlay-close:hover {
                    background: rgba(255, 255, 255, 0.18);
                }
                @keyframes lanyard-overlay-in {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
}
