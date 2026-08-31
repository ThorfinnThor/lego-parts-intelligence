import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { getAllSets } from '@/lib/data/static-catalogue';
import { pluralize } from '@/lib/format';

export const dynamic = 'force-static';
export const revalidate = false;
export const metadata: Metadata = { title: 'Set catalogue', alternates: { canonical: '/sets/' } };

export default function SetsPage() {
  const sets = getAllSets();
  return (
    <div className="shell page-shell">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Sets' }]} />
      <p className="eyebrow">Static catalogue</p>
      <h1>Sets</h1>
      <p className="lede">Browse the support-set cohort and inspect the documented parts and minifigures in each versioned inventory.</p>
      <div className="list-grid">
        {sets.map((set) => (
          <article className="list-card" key={set.id}>
            <span className="part-id">{set.id}</span>
            <h2><Link href={`/sets/${set.slug}/`}>{set.name}</Link></h2>
            <p>{set.year ?? 'Unknown year'} · {set.theme ?? 'Unknown theme'}</p>
            <p>{pluralize(set.totalParts, 'documented part unit')} · {pluralize(set.totalMinifigs, 'minifigure')}</p>
          </article>
        ))}
      </div>
      <p className="source-note">Data sourced from Rebrickable. This page lists only sets selected for the current static release cohort.</p>
    </div>
  );
}
