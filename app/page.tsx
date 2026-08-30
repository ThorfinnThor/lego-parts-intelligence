import Link from 'next/link';
import { getAllParts, getManifest } from '@/lib/data/static-catalogue';

export const dynamic = 'force-static';
export const revalidate = false;

export default function HomePage() {
  const manifest = getManifest();
  const featured = getAllParts().filter((part) => part.indexable).slice(0, 3);
  return (
    <>
      <section className="hero shell">
        <p className="eyebrow">Catalogue intelligence, without the guesswork</p>
        <h1>Find the parts. Understand the connections.</h1>
        <p className="hero-copy">Explore where a part appears, which colors are documented, how variants relate, and which sets contain the most useful inventory—without pretending catalogue signals are prices.</p>
        <div className="hero-actions">
          <Link className="button primary" href="/search/">Search the catalogue</Link>
          <Link className="button secondary" href="/methodology/donor-score/">How donor scoring works</Link>
        </div>
        <div className="release-note" aria-label="Release details">
          <span><strong>{manifest.counts.parts}</strong> parts in this build</span>
          <span><strong>{manifest.counts.sets}</strong> support sets</span>
          <span><strong>0</strong> runtime database calls</span>
        </div>
      </section>
      <section className="shell section">
        <div className="section-heading">
          <div><p className="eyebrow">Start exploring</p><h2>Fixture catalogue highlights</h2></div>
          <Link href="/parts/">View all parts →</Link>
        </div>
        <div className="card-grid">
          {featured.map((part) => (
            <article className="part-card" key={part.id}>
              <div className="part-id">Part {part.id}</div>
              <h3><Link href={`/parts/${part.slug}/`}>{part.name}</Link></h3>
              <p>{part.statistics.setCount} sets · {part.statistics.colorCount} colors · {part.statistics.totalQuantity} catalogue units</p>
              <Link className="text-link" href={`/donor-sets/${part.slug}/`}>View donor ranking</Link>
            </article>
          ))}
        </div>
      </section>
      <section className="trust-strip">
        <div className="shell trust-grid">
          <div><strong>Versioned</strong><span>Every page comes from one pinned release.</span></div>
          <div><strong>Transparent</strong><span>Scores show their method and limitations.</span></div>
          <div><strong>Static-first</strong><span>Fast delivery with no public catalogue database.</span></div>
        </div>
      </section>
    </>
  );
}
