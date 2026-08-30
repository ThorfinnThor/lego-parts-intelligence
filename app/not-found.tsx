import Link from 'next/link';

export default function NotFound() { return <div className="shell page-shell narrow"><p className="eyebrow">404</p><h1>That catalogue page is not in this release.</h1><p className="lede">It may be excluded by a quality gate or its stable URL may have changed.</p><Link className="button primary" href="/search/">Search the catalogue</Link></div>; }
