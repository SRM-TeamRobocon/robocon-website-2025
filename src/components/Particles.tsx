"use client";

import React, { useCallback } from "react";
import { usePathname } from "next/navigation";
import Particles from "react-tsparticles";
import type { Engine } from "tsparticles-engine";
import { loadFull } from "tsparticles";

export default function ParticlesCom() {
    // The dashboard is a dense UI with lots of clicking/hovering over real controls —
    // the particles' click-push/hover-repulse reacting to that is distracting there, so
    // it's disabled for /dashboard and every subpage while staying on everywhere else.
    const pathname = usePathname();
    const interactive = !pathname?.startsWith("/dashboard");

    const particlesInit = useCallback(async (engine: Engine) => {
        // you can initialize the tsParticles instance (engine) here, adding custom shapes or presets
        // this loads the tsparticles package bundle, it's the easiest method for getting everything ready
        // starting from v2 you can add only the features you need reducing the bundle size
        await loadFull(engine);
    }, []);

    return (
        <Particles
            className="fixed w-full h-full z-0 pointer-events-none"
            id="tsparticles"
            init={particlesInit}
            options={{
                fpsLimit: 30,
                interactivity: {
                    events: {
                        onClick: {
                            enable: interactive,
                            mode: "push",
                        },
                        onHover: {
                            enable: interactive,
                            mode: "repulse",
                        },
                        resize: true,
                    },
                    modes: {
                        push: {
                            quantity: 4,
                        },
                        repulse: {
                            distance: 150,
                            duration: 0.4,
                        },
                    },
                },
                particles: {
                    color: {
                        value: "#D5D5D5",
                    },
                    links: {
                        color: "#D5D5D5",
                        distance: 500,
                        enable: true,
                        opacity: 0.5,
                        width: 1,
                    },
                    move: {
                        direction: "none",
                        enable: true,
                        outModes: {
                            default: "bounce",
                        },
                        random: false,
                        speed: 3,
                        straight: false,
                    },
                    number: {
                        density: {
                            enable: true,
                            area: 800,
                        },
                        value: 15,
                        limit: 50,
                    },
                    opacity: {
                        value: 1,
                    },
                    shape: {
                        type: "circle",
                    },
                    size: {
                        value: { min: 0, max: 2 },
                    },
                },
                detectRetina: true,
            }}
        />
    );
}
