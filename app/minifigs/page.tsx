import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { getAllMinifigs } from '@/lib/data/static-catalogue';
import { pluralize } from '@/lib/format';

export const dynamic = 'force-static';
export const revalidate = false;
export const metadata: Metadata = { title: 'Minifigure catalogue', alternates: { canonical: '/minifigs/' } };

export default function MinifigsPage() {
  const minifigs = getAllMinifigs();
  return (
    <div className="shell page-shell">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Minifigures' }]} />
      <p className="eyebrow">Static catalogue</p>
      <h1>Minifigures</h1>
      <p className="lede">Explore documented set appearances and the component-part inventory for each included minifigure.</p>
      <div className="list-grid">
        {minifigs.map((minifig) => (
          <article className="list-card" key={minifig.id}>
            <span className="part-id">{minifig.id}</span>
            <h2><Link href={`/minifigs/${minifig.slug}/`}>{minifig.name}</Link></h2>
            <p>{pluralize(minifig.statistics.setCount, 'set')} · {pluralize(minifig.statistics.componentPartCount, 'component unit')}</p>
          </article>
        ))}
      </div>
      <p className="source-note">Data sourced from Rebrickable.</p>
    </div>
  );
}
