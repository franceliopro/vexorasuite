import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap footer-row">
        <p>Copyright©2024 - rastreabem.com.br</p>
        <Link href="/" aria-label="Rastreabem – início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="Rastreabem" />
        </Link>
        <a href="tel:08004442434">
          <strong>
            <span aria-hidden="true" className="phone-icon" /> 0800 444-2434
          </strong>
        </a>
      </div>
    </footer>
  );
}
