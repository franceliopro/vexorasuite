import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteScripts } from "@/components/SiteScripts";
import { navigation } from "@/content/navigation";
import "./globals.css";

const home = navigation[0];

export const metadata: Metadata = {
  title: { default: home.title, template: "%s" },
  description: home.description,
  icons: { icon: "/images/cropped-logo2-32x32.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip" href="#conteudo">
          Ir para o conteúdo
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
        <SiteScripts />
      </body>
    </html>
  );
}
