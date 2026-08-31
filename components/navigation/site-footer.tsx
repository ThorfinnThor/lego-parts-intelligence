import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <strong>Parts Intelligence</strong>
          <p>Independent catalogue analysis for builders. Not sponsored, authorized, or endorsed by the LEGO Group.</p>
        </div>
        <div>
          <strong>Transparency</strong>
          <p>Data sourced from Rebrickable.</p>
          <p><Link href="/methodology/data-sources/">Sources</Link> · <Link href="/legal/">Legal</Link> · <Link href="/about/">About</Link></p>
        </div>
      </div>
    </footer>
  );
}
