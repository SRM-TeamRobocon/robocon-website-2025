import type { Metadata, Viewport } from "next";
import DashboardLayoutClient from "./DashboardLayoutClient";

export const metadata: Metadata = {
    manifest: "/manifest.webmanifest",
    icons: {
        apple: "/apple-touch-icon.png",
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "Robocon Dashboard",
    },
};

export const viewport: Viewport = {
    themeColor: "#000000",
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
