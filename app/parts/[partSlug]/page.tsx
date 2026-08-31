import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ScoreMeter } from '@/components/ui/score-meter';
import { getDonorData, getPartBySlug, getPartPageParams, isPartPageAvailable, isRelationshipPageAvailable, isSetPageAvailable } from '@/lib/data/static-catalogue';
import { pluralize } from '@/lib/format';

export const dynamic = 'force-static';
export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
  return getPartPageParams();
}

export async function generateMetadata({ params }: { params: Promise<{ partSlug: string }> }): Promise<Metadata> {
  const { partSlug } = await params;
  const part = getPartBySlug(partSlug);
  if (!part) return {};
  return {
    title: `Part ${part.id} ${part.name} – Sets, Colors & Alternatives`,
    description: `${part.name} (${part.id}) appears in ${pluralize(part.statistics.setCount, 'documented set')} and ${pluralize(part.statistics.colorCount, 'color')} in this catalogue release.`,
    alternates: { canonical: `/parts/${part.slug}/` },
    robots: part.indexable ? undefined : { index: false, follow: true },
  };
}

export default async function PartPage({ params }: { params: Promise<{ partSlug: string }> }) {
  const { partSlug } = await params;
  const part = getPartBySlug(partSlug);
  if (!part) notFound();
  const donor = getDonorData(partSlug);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${part.name} (${part.id}) catalogue record`,
    dateModified: part.updatedAt,
    isBasedOn: 'https://rebrickable.com/',
  };
  return (
    <div className="shell page-shell">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Parts', href: '/parts/' }, { label: part.name }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <header className="entity-header">
        <div>
          <p className="eyebrow">Part {part.id}</p>
          <h1>{part.name}</h1>
          <p className="lede">A catalogue view of documented set occurrences, colors, and source-declared relationships.</p>
        </div>
        <div className="entity-badge">{part.category?.name ?? 'Uncategorized'}</div>
      </header>

      <section className="stats-grid" aria-label="Part statistics">
        <div><strong>{part.statistics.setCount}</strong><span>{part.statistics.setCount === 1 ? 'set' : 'sets'}</span></div>
        <div><strong>{part.statistics.colorCount}</strong><span>{part.statistics.colorCount === 1 ? 'color' : 'colors'}</span></div>
        <div><strong>{part.statistics.totalQuantity}</strong><span>{part.statistics.totalQuantity === 1 ? 'catalogue unit' : 'catalogue units'}</span></div>
        <div><strong>{part.years.first ?? '—'}–{part.years.last ?? '—'}</strong><span>documented years</span></div>
      </section>

      <div className="content-grid">
        <div className="content-main">
          <section className="panel">
            <div className="section-heading"><div><p className="eyebrow">Occurrences</p><h2>Top sets</h2></div></div>
            <div className="table-wrap"><table><thead><tr><th>Set</th><th>Year</th><th className="number">Quantity</th></tr></thead><tbody>
              {part.topSets.map((set) => <tr key={set.id}><td>{isSetPageAvailable(set.slug) ? <Link href={`/sets/${set.slug}/`}>{set.name} <small>{set.id}</small></Link> : <>{set.name} <small>{set.id}</small></>}</td><td>{set.year ?? '—'}</td><td className="number">{set.quantity}</td></tr>)}
            </tbody></table></div>
          </section>
          <section className="panel">
            <p className="eyebrow">Documented colors</p><h2>Color coverage</h2>
            <div className="color-list">
              {part.topColors.map((color) => <div key={color.id}><span className="swatch" style={{ background: color.rgb ? `#${color.rgb}` : '#ddd' }} aria-hidden="true" /><span><strong>{color.name}</strong><small>{pluralize(color.setCount, 'set')} · {pluralize(color.totalQuantity, 'unit')}</small></span></div>)}
            </div>
          </section>
          <section className="panel">
            <p className="eyebrow">Source-declared links</p><h2>Relationships</h2>
            {part.relationships.length ? <ul className="relationship-list">{part.relationships.map((relation) => <li key={`${relation.type}-${relation.targetPartId}`}><span>{relation.type.replaceAll('_', ' ')}</span>{isPartPageAvailable(relation.targetSlug) ? <Link href={`/parts/${relation.targetSlug}/`}>{relation.targetName} ({relation.targetPartId})</Link> : <span>{relation.targetName} ({relation.targetPartId})</span>}</li>)}</ul> : <p>No source-declared relationships are included in this release.</p>}
            {isRelationshipPageAvailable(part.slug) ? <p><Link className="text-link" href={`/parts/${part.slug}/relationships/`}>Open the relationship methodology view →</Link></p> : null}
          </section>
        </div>
        <aside className="content-aside">
          <div className="panel sticky-panel">
            <p className="eyebrow">Catalogue signals</p>
            <ScoreMeter label="Commonality" score={part.statistics.commonalityScore ?? 0} />
            <ScoreMeter label="Rarity" score={part.statistics.rarityScore ?? 0} />
            <p className="fine-print">Rarity is relative catalogue coverage—not market price or collector value.</p>
            <Link className="text-link" href="/methodology/rarity/">Read the methodology</Link>
            {donor?.indexable ? <Link className="button primary full" href={`/donor-sets/${part.slug}/`}>Compare donor sets</Link> : null}
          </div>
        </aside>
      </div>
      <p className="source-note">Data sourced from Rebrickable. Release updated {part.updatedAt.slice(0, 10)}.</p>
    </div>
  );
}
