"use client";

// A lightweight CSS-only lanyard: a strap (glossy) + clip + card hang together as
// one pendulum. It idly sways, tilts toward the pointer on hover, and can be
// grabbed and swung by dragging the card — released, it springs back and resumes
// the idle sway. A plain click (no drag) opens the badge full-size instead.
import { useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";

interface LanyardBadgeProps {
    badgeImage: string; // data URL from generateBadgeImage — logo + name + QR
    className?: string;
}

const DRAG_CLICK_THRESHOLD = 4; // px of pointer movement before a drag counts as a swing, not a click
const DRAG_SENSITIVITY = 4; // px of pointer movement per degree of rotation
const DRAG_MAX_ANGLE = 55;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export default function LanyardBadge({ badgeImage, className = "" }: LanyardBadgeProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [hovering, setHovering] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const [dragAngle, setDragAngle] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isReleasing, setIsReleasing] = useState(false);
    const dragStateRef = useRef<{ startX: number; startAngle: number; moved: boolean } | null>(null);

    const applyTilt = (e: PointerEvent<HTMLDivElement>) => {
        const el = cardRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        setTilt({ x: py * -14, y: px * 18 });
    };

    // Bound to the whole pendulum (strap + clip + card), not just the card — the strap
    // is the visually dominant part, and a user's first instinct is to grab it, not the
    // small card hanging below it.
    const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStateRef.current = { startX: e.clientX, startAngle: dragAngle, moved: false };
        setIsDragging(true);
        setIsReleasing(false);
        // The hover-tilt (rotateX/rotateY on the card) is independent of the pendulum's
        // rotate(deg) swing. If it's left at a stale nonzero value from before the drag
        // started, it stacks with the swing and the badge visibly wobbles up/down as well
        // as side to side. Zero it out so dragging is a clean single-axis rotation.
        setTilt({ x: 0, y: 0 });
    };

    const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (isDragging && drag) {
            const dx = e.clientX - drag.startX;
            if (Math.abs(dx) > DRAG_CLICK_THRESHOLD) drag.moved = true;
            setDragAngle(clamp(drag.startAngle + dx / DRAG_SENSITIVITY, -DRAG_MAX_ANGLE, DRAG_MAX_ANGLE));
        } else if (cardRef.current?.contains(e.target as Node)) {
            // Hover-tilt only makes sense relative to the card's own rect — skip it
            // while hovering the strap so the tilt doesn't compute nonsense values.
            applyTilt(e);
        } else if (tilt.x !== 0 || tilt.y !== 0) {
            setTilt({ x: 0, y: 0 });
        }
    };

    const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        dragStateRef.current = null;
        setIsDragging(false);
        if (drag?.moved) {
            setIsReleasing(true);
            setDragAngle(0);
        } else if (drag) {
            // A tap/click with no meaningful movement — open the full-size view.
            setExpanded(true);
        }
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const manual = isDragging || isReleasing;

    return (
        <div className={`lanyard-badge-scene ${className}`}>
            {/* Strap, clip, and card all live inside one swaying pendulum so they move
                together as a single rigid body, pivoting from the top. */}
            <div
                className={`lanyard-badge-pendulum ${hovering && !manual ? "is-paused" : ""} ${
                    manual ? "is-manual" : ""
                } ${isReleasing ? "is-releasing" : ""} ${isDragging ? "is-dragging" : ""}`}
                style={manual ? { transform: `rotate(${dragAngle}deg)` } : undefined}
                onTransitionEnd={(e) => {
                    if (e.propertyName === "transform" && isReleasing) setIsReleasing(false);
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerEnter={() => setHovering(true)}
                onPointerLeave={() => {
                    setHovering(false);
                    if (!isDragging) setTilt({ x: 0, y: 0 });
                }}
            >
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
                <div
                    ref={cardRef}
                    className="lanyard-badge-card"
                    style={{
                        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                    }}
                >
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
                    perspective: 1200px;
                    /* Both axes must be non-"visible" together: per the CSS overflow spec, a
                       lone overflow-y: visible next to overflow-x: hidden computes to auto,
                       not visible — and since the pendulum's rotate() transform continuously
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
                    filter: drop-shadow(0 28px 34px rgba(0, 0, 0, 0.45));
                    cursor: grab;
                    touch-action: none;
                }
                .lanyard-badge-pendulum.is-paused {
                    animation-play-state: paused;
                }
                .lanyard-badge-pendulum.is-manual {
                    animation: none;
                }
                .lanyard-badge-pendulum.is-releasing {
                    transition: transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .lanyard-badge-pendulum.is-dragging {
                    cursor: grabbing;
                }
                .lanyard-badge-strap {
                    position: relative;
                    width: 52px;
                    /* Scales with the card so the whole assembly grows/shrinks together
                       instead of drifting apart like the old vh-based height did. Shorter
                       ratio than before — the strap was dominating the composition with
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
                    transition: transform 0.15s ease-out;
                    transform-style: preserve-3d;
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
