import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DevDesk — Developer Productivity Dashboard",
    short_name: "DevDesk",
    description:
      "A customizable, offline-ready developer productivity dashboard with notes, snippets, a Kanban task board, a terminal, and live system metrics.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#09090b",
    theme_color: "#09090b",
    categories: ["productivity", "developer", "utilities"],
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Task Board",
        short_name: "Tasks",
        url: "/?widget=task-board",
      },
      {
        name: "Snippet Manager",
        short_name: "Snippets",
        url: "/?widget=snippets",
      },
      {
        name: "Terminal",
        short_name: "Terminal",
        url: "/?widget=terminal",
      },
    ],
  };
}
