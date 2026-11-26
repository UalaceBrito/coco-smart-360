import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "COCO SMART 360",
    short_name: "COCO SMART",
    description: "Gestão inteligente do coqueiral.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f5ef",
    theme_color: "#1d5b43",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
