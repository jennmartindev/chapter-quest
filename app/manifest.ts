import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dog Ears & Dunes",
    short_name: "Dog Ears",
    description: "Your cozy companion for every reading challenge.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#2E4047",
    theme_color: "#2E4047",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
