import type { Metadata, Viewport } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import "./vexora-design-system.css";


/* Fonts are downloaded at build time and served from our own origin: the UI no longer
   waits on a third-party font CDN, including when the app is installed as a PWA. */
const bodyFont = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-src",
  display: "swap",
});

const displayFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display-src",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Véxora Suite",
  description: "Plataforma de atendimento e operações empresariais.",
  applicationName: "Véxora Suite",
  manifest: "/manifest.webmanifest",
  appleWebApp: {capable:true,statusBarStyle:"default",title:"Véxora"},
  icons: {apple:"/pwa/icon/180",icon:"/pwa/icon/192"},
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#111827",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" data-theme="hybrid" suppressHydrationWarning className={`${bodyFont.variable} ${displayFont.variable}`}>
      <head><script dangerouslySetInnerHTML={{__html:`try{const theme=localStorage.getItem("vexora:theme");if(["light","dark","hybrid"].includes(theme))document.documentElement.dataset.theme=theme}catch{}`}}/></head>
      <body>{children}</body>
    </html>
  );
}


