import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import {
  getPartBySlug,
  getRelationshipPageParams,
  isPartPageAvailable,
} from '@/lib/data/static-catalogue';

export const dynamic = 'force-static';
export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
  return getRelationshipPageParams();
}

export async function generateMetadata({ params }: { params: Promise<{ partSlug: string }> }): Promise<Metadata> {
  const { partSlug } = await params;
  const part = getPartBySlug(partSlug);
  if (!part) return {};
  return {
    title: `Relationships for ${part.name} (${part.id})`,
    description: `Source-declared mold, alternate, print, and replacement relationships documented for ${part.name} (${part.id}).`,
    alternates: { canonical: `/parts/${part.slug}/relationships/` },
  };
}

export default async function RelationshipPage({ params }: { params: Promise<{ partSlug: string }> }) {
  const { partSlug } = await params;
  const part = getPartBySlug(partSlug);
  if (!part || part.relationships.length === 0) notFound();
  const partPageAvailable = isPartPageAvailable(part.slug);

  return <div className="shell page-shell narrow">
    <Breadcrumbs items={[
      { label: 'Home', href: '/' },
      { label: 'Parts', href: '/parts/' },
      { label: part.name, ...(partPageAvailable ? { href: `/parts/${part.slug}/` } : {}) },
      { label: 'Relationships' },
    ]} />
    <p className="eyebrow">Source-declared part graph · {part.id}</p>
    <h1>Relationships for {part.name}</h1>
    <p className="lede">This page separates source-declared mold, alternate, print, and replacement links from inferred compatibility. Unknown relationship codes remain explicitly unknown.</p>
    <div className="notice"><strong>Interpretation boundary</strong><span>A catalogue relationship does not guarantee physical interchangeability, fit, availability, or market value.</span></div>
    <section className="panel">
      <h2>Documented related parts</h2>
      <ul className="relationship-list">
        {part.relationships.map((relation) => <li key={`${relation.type}-${relation.targetPartId}`}>
          <span>{relation.type.replaceAll('_', ' ')}</span>
          {isPartPageAvailable(relation.targetSlug)
            ? <Link href={`/parts/${relation.targetSlug}/`}>{relation.targetName} ({relation.targetPartId})</Link>
            : <span>{relation.targetName} ({relation.targetPartId})</span>}
        </li>)}
      </ul>
    </section>
    {partPageAvailable ? <p><Link className="text-link" href={`/parts/${part.slug}/`}>Return to the complete part record →</Link></p> : null}
    <p className="source-note">Data sourced from Rebrickable. Release updated {part.updatedAt.slice(0, 10)}.</p>
  </div>;
}
