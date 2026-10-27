import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme-system.css";

export const metadata: Metadata = {
  title: "Véxora Suite",
  description: "Plataforma de atendimento e operações empresariais.",
  applicationName: "Véxora Suite",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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

