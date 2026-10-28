import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme-system.css";
import "./workspace-refinements.css";
import "./mobile-app.css";
import "./interface-system.css";
import "./mobile-scroll.css";
import "./home-presentation.css";

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
    <html lang="pt-BR" data-theme="hybrid" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:`try{const theme=localStorage.getItem("vexora:theme");if(["light","dark","hybrid"].includes(theme))document.documentElement.dataset.theme=theme}catch{}`}}/></head>
      <body>{children}</body>
    </html>
  );
}


