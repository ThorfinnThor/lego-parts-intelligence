import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell nav-shell">
        <Link className="brand" href="/" aria-label="Parts Intelligence home">
          <span className="brand-mark" aria-hidden="true">PI</span>
          <span>Parts Intelligence</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/parts/">Parts</Link>
          <Link href="/sets/">Sets</Link>
          <Link href="/minifigs/">Minifigures</Link>
          <Link href="/search/">Search</Link>
          <Link href="/rankings/most-common-parts/">Rankings</Link>
          <Link href="/methodology/data-sources/">Methodology</Link>
        </nav>
      </div>
    </header>
  );
}
