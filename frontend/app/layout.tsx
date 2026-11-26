import type { Metadata, Viewport } from "next";
import ServiceWorkerRegistration from "./service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "COCO SMART 360 | Gestão inteligente do coqueiral",
  description: "Plataforma de gestão e apoio à decisão para a cocoicultura.",
  applicationName: "COCO SMART 360",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "COCO SMART 360",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#1d5b43",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
