import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ServiceWorkerProvider } from "@/components/providers/service-worker-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

const description =
  "A customizable, offline-ready developer productivity dashboard with notes, snippets, a Kanban task board, a terminal, and live system metrics.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DevDesk — Developer Productivity Dashboard",
    template: "%s · DevDesk",
  },
  description,
  applicationName: "DevDesk",
  keywords: [
    "developer dashboard",
    "productivity",
    "kanban",
    "task board",
    "snippets",
    "terminal",
    "pomodoro",
    "PWA",
  ],
  authors: [{ name: "DevDesk" }],
  creator: "DevDesk",
  category: "productivity",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "DevDesk",
    title: "DevDesk — Developer Productivity Dashboard",
    description,
    url: "/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DevDesk — your entire dev workflow in one dashboard.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DevDesk — Developer Productivity Dashboard",
    description,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    title: "DevDesk",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

const themeInit = `(function(){try{var ok=["light","dark","nord","dracula","oled","vercel","tokyo"];var t=JSON.parse(localStorage.getItem("devdesk:theme"));if(ok.indexOf(t)>-1){document.documentElement.setAttribute("data-theme",t)}var aok=["theme","indigo","emerald","cyan","rose","amber"];var a=JSON.parse(localStorage.getItem("devdesk:accent"));if(aok.indexOf(a)>-1){document.documentElement.setAttribute("data-accent",a)}var c=JSON.parse(localStorage.getItem("devdesk:theme-custom"));if(c&&c.enabled&&/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(c.accent))){var r=document.documentElement;var hx=function(h){h=String(h).replace("#","");if(h.length===3){h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]}return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]};var sh=function(hex,f){return "#"+hx(hex).map(function(v){var n=f<0?Math.round(v*(1+f)):Math.round(v+(255-v)*f);n=Math.max(0,Math.min(255,n));return("0"+n.toString(16)).slice(-2)}).join("")};var rgb=hx(c.accent);r.style.setProperty("--primary",c.accent);r.style.setProperty("--primary-strong",sh(c.accent,-0.16));r.style.setProperty("--ring",sh(c.accent,0.2));r.style.setProperty("--glow",rgb[0]+" "+rgb[1]+" "+rgb[2]);r.style.setProperty("--accent","color-mix(in oklab, "+c.accent+" 16%, transparent)");r.style.setProperty("--card-bg","color-mix(in oklab, var(--card) "+(c.surfaceOpacity==null?70:c.surfaceOpacity)+"%, transparent)");r.style.setProperty("--glass-blur",(c.glassBlur==null?16:c.glassBlur)+"px");r.style.setProperty("--border-color",c.borderTint);r.style.setProperty("--border",c.borderTint)}}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-accent="theme"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <ToastProvider>
            <ServiceWorkerProvider />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
