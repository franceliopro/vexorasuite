"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { navigation } from "@/content/navigation";

const appLinks = [
  { label: "Android", items: [
    { text: "Hapolo", href: "https://play.google.com/store/search?q=hapolo&c=apps" },
    { text: "RotaExata", href: "https://play.google.com/store/apps/details?id=com.eurotagestor" },
    { text: "Rastreabem (APK)", href: "https://drive.google.com/file/d/1GZWacRkJzWi8cFacZLC0ZllysvfE10WV/view" },
  ] },
  { label: "iPhone", items: [
    { text: "Hapolo", href: "https://apps.apple.com/br/app/hapolo-app/id1443689582" },
    { text: "RotaExata", href: "https://apps.apple.com/br/app/eurota-gestor/id6444657019" },
  ] },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="header">
      <div className="wrap header-row">
        <Link className="brand" href="/" aria-label="Rastreabem – início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="Rastreabem" />
        </Link>
        <button
          className="menu-toggle"
          type="button"
          aria-controls="menu"
          aria-expanded={open}
          aria-label="Menu"
          onClick={() => setOpen((value) => !value)}
        >
          ☰
        </button>
        <nav id="menu" className={open ? "open" : undefined} aria-label="Menu principal">
          <a href="https://painel.rastreabem.com.br/">Área do Cliente</a>
          {navigation.filter((page) => page.group === "principal" && page.slug !== "index").map((page) => (
            <Link key={page.slug} href={page.path}>
              {page.label}
            </Link>
          ))}
          <details className="app-menu">
            <summary>App</summary>
            <div className="app-links">
              {appLinks.map((group) => (
                <Fragment key={group.label}>
                  <strong>{group.label}</strong>
                  {group.items.map((item) => (
                    <a key={item.href} href={item.href}>
                      {item.text}
                    </a>
                  ))}
                </Fragment>
              ))}
            </div>
          </details>
        </nav>
        <a className="phone" href="tel:08004442434">
          <span aria-hidden="true" className="phone-icon" /> 0800 444-2434
        </a>
        <a className="client-mobile" href="https://painel.rastreabem.com.br/">
          ÁREA DO CLIENTE
        </a>
      </div>
    </header>
  );
}
