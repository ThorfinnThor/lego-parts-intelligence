import Link from 'next/link';
import { getAllMinifigs, getAllParts, getAllSets, getManifest } from '@/lib/data/static-catalogue';
import { pluralize } from '@/lib/format';

export const dynamic = 'force-static';
export const revalidate = false;

export default function HomePage() {
  const manifest = getManifest();
  const featured = getAllParts().filter((part) => part.indexable).slice(0, 3);
  const featuredMinifigs = getAllMinifigs().slice(0, 3);
  const featuredSets = getAllSets().slice(0, 3);
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
          <span><strong>{manifest.counts.parts}</strong> {manifest.counts.parts === 1 ? 'part' : 'parts'} in this build</span>
          <span><strong>{manifest.counts.sets}</strong> support {manifest.counts.sets === 1 ? 'set' : 'sets'}</span>
          <span><strong>{manifest.counts.minifigs}</strong> {manifest.counts.minifigs === 1 ? 'minifigure' : 'minifigures'}</span>
          <span><strong>0</strong> runtime database calls</span>
        </div>
      </section>
      <section className="shell section">
        <div className="section-heading">
          <div><p className="eyebrow">Start exploring</p><h2>Catalogue highlights</h2></div>
          <Link href="/parts/">View all parts →</Link>
        </div>
        <div className="card-grid">
          {featured.map((part) => (
            <article className="part-card" key={part.id}>
              <div className="part-id">Part {part.id}</div>
              <h3><Link href={`/parts/${part.slug}/`}>{part.name}</Link></h3>
              <p>{pluralize(part.statistics.setCount, 'set')} · {pluralize(part.statistics.colorCount, 'color')} · {pluralize(part.statistics.totalQuantity, 'catalogue unit')}</p>
              <Link className="text-link" href={`/donor-sets/${part.slug}/`}>View donor ranking</Link>
            </article>
          ))}
        </div>
      </section>
      {featuredMinifigs.length > 0 ? <section className="shell section section-secondary">
        <div className="section-heading">
          <div><p className="eyebrow">Minifigure intelligence</p><h2>Set appearances and components</h2></div>
          <Link href="/minifigs/">View all minifigures →</Link>
        </div>
        <div className="card-grid">
          {featuredMinifigs.map((minifig) => (
            <article className="part-card" key={minifig.id}>
              <div className="part-id">{minifig.id}</div>
              <h3><Link href={`/minifigs/${minifig.slug}/`}>{minifig.name}</Link></h3>
              <p>{pluralize(minifig.statistics.setCount, 'set')} · {pluralize(minifig.statistics.componentPartCount, 'component unit')}</p>
              <Link className="text-link" href={`/minifigs/${minifig.slug}/`}>Open minifigure record</Link>
            </article>
          ))}
        </div>
      </section> : null}
      {featuredSets.length > 0 ? <section className="shell section">
        <div className="section-heading">
          <div><p className="eyebrow">Support-set intelligence</p><h2>Sets in this release</h2></div>
          <Link href="/sets/">View all sets →</Link>
        </div>
        <div className="card-grid">
          {featuredSets.map((set) => (
            <article className="part-card" key={set.id}>
              <div className="part-id">{set.id}</div>
              <h3><Link href={`/sets/${set.slug}/`}>{set.name}</Link></h3>
              <p>{set.year ?? 'Unknown year'} · {set.theme ?? 'Unknown theme'}</p>
              <p>{pluralize(set.totalParts, 'documented part unit')} · {pluralize(set.totalMinifigs, 'minifigure')}</p>
              <Link className="text-link" href={`/sets/${set.slug}/`}>Open set inventory</Link>
            </article>
          ))}
        </div>
      </section> : null}
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
