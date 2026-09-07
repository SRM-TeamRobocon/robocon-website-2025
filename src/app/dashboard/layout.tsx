import type { Metadata, Viewport } from "next";
import DashboardLayoutClient from "./DashboardLayoutClient";

export const metadata: Metadata = {
    manifest: "/manifest.webmanifest",
    icons: {
        apple: [
            { url: "/apple-touch-icon-dark.png" },
            { url: "/apple-touch-icon-light.png", media: "(prefers-color-scheme: light)" },
            { url: "/apple-touch-icon-dark.png", media: "(prefers-color-scheme: dark)" },
        ],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "STR Hub",
    },
};

export const viewport: Viewport = {
    themeColor: "#C20000",
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
