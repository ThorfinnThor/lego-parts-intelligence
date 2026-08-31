import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import {
  getMinifigBySlug,
  getMinifigPageParams,
  isPartPageAvailable,
  isSetPageAvailable,
} from '@/lib/data/static-catalogue';
import { pluralize } from '@/lib/format';

export const dynamic = 'force-static';
export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
  return getMinifigPageParams();
}

export async function generateMetadata({ params }: { params: Promise<{ minifigSlug: string }> }): Promise<Metadata> {
  const { minifigSlug } = await params;
  const minifig = getMinifigBySlug(minifigSlug);
  if (!minifig) return {};
  return {
    title: `${minifig.name} (${minifig.id}) – Sets & Component Parts`,
    description: `${minifig.name} (${minifig.id}) appears in ${pluralize(minifig.statistics.setCount, 'documented set')} in this catalogue release.`,
    alternates: { canonical: `/minifigs/${minifig.slug}/` },
  };
}

export default async function MinifigPage({ params }: { params: Promise<{ minifigSlug: string }> }) {
  const { minifigSlug } = await params;
  const minifig = getMinifigBySlug(minifigSlug);
  if (!minifig) notFound();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${minifig.name} (${minifig.id}) catalogue record`,
    dateModified: minifig.updatedAt,
    isBasedOn: 'https://rebrickable.com/',
  };
  return (
    <div className="shell page-shell">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Minifigures', href: '/minifigs/' }, { label: minifig.name }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <header className="entity-header">
        <div>
          <p className="eyebrow">Minifigure {minifig.id}</p>
          <h1>{minifig.name}</h1>
          <p className="lede">A versioned catalogue view of documented set appearances and source inventory components.</p>
        </div>
        <div className="entity-badge">Minifigure</div>
      </header>

      <section className="stats-grid" aria-label="Minifigure statistics">
        <div><strong>{minifig.statistics.setCount}</strong><span>{minifig.statistics.setCount === 1 ? 'set' : 'sets'}</span></div>
        <div><strong>{minifig.statistics.totalQuantity}</strong><span>catalogue quantity</span></div>
        <div><strong>{minifig.statistics.componentPartCount}</strong><span>component units</span></div>
        <div><strong>{minifig.declaredPartCount}</strong><span>declared parts</span></div>
      </section>

      <div className="content-main">
        <section className="panel">
          <p className="eyebrow">Appearances</p><h2>Documented sets</h2>
          <div className="table-wrap"><table><thead><tr><th>Set</th><th>Year</th><th className="number">Quantity</th></tr></thead><tbody>
            {minifig.sets.map((set) => <tr key={set.id}><td>{isSetPageAvailable(set.slug) ? <Link href={`/sets/${set.slug}/`}>{set.name} <small>{set.id}</small></Link> : <>{set.name} <small>{set.id}</small></>}</td><td>{set.year ?? '—'}</td><td className="number">{set.quantity}</td></tr>)}
          </tbody></table></div>
        </section>
        <section className="panel">
          <p className="eyebrow">Inventory</p><h2>Component parts</h2>
          <div className="table-wrap"><table><thead><tr><th>Part</th><th className="number">Quantity</th></tr></thead><tbody>
            {minifig.parts.map((part) => <tr key={part.id}><td>{isPartPageAvailable(part.slug) ? <Link href={`/parts/${part.slug}/`}>{part.name} <small>{part.id}</small></Link> : <>{part.name} <small>{part.id}</small></>}</td><td className="number">{part.quantity}</td></tr>)}
          </tbody></table></div>
        </section>
      </div>
      <p className="source-note">Data sourced from Rebrickable. Release updated {minifig.updatedAt.slice(0, 10)}.</p>
    </div>
  );
}
