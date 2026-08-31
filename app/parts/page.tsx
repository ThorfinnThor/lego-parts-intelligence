import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { getAllParts } from '@/lib/data/static-catalogue';
import { pluralize } from '@/lib/format';

export const dynamic = 'force-static';
export const revalidate = false;

export const metadata: Metadata = { title: 'Parts catalogue', alternates: { canonical: '/parts/' } };

export default function PartsPage() {
  const parts = getAllParts();
  return (
    <div className="shell page-shell">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Parts' }]} />
      <p className="eyebrow">Static catalogue</p>
      <h1>Parts</h1>
      <p className="lede">Each useful page combines occurrences, colors, relationships, and versioned catalogue statistics.</p>
      <div className="list-grid">
        {parts.map((part) => (
          <article className="list-card" key={part.id}>
            <span className="part-id">{part.id}</span>
            <h2><Link href={`/parts/${part.slug}/`}>{part.name}</Link></h2>
            <p>{part.category?.name ?? 'Uncategorized'} · {pluralize(part.statistics.setCount, 'set')}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
