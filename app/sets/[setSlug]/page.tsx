import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { getSetBySlug, getSetPageParams } from '@/lib/data/static-catalogue';

export const dynamic = 'force-static';
export const revalidate = false;
export const dynamicParams = false;
export function generateStaticParams() { return getSetPageParams(); }

export async function generateMetadata({ params }: { params: Promise<{ setSlug: string }> }): Promise<Metadata> {
  const { setSlug } = await params;
  const set = getSetBySlug(setSlug);
  return set ? { title: `${set.name} (${set.id}) inventory`, alternates: { canonical: `/sets/${set.slug}/` } } : {};
}

export default async function SetPage({ params }: { params: Promise<{ setSlug: string }> }) {
  const { setSlug } = await params;
  const set = getSetBySlug(setSlug);
  if (!set) notFound();
  return <div className="shell page-shell">
    <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Sets' }, { label: set.name }]} />
    <p className="eyebrow">Support set · {set.id}</p><h1>{set.name}</h1>
    <p className="lede">{set.year ?? 'Unknown year'} · {set.theme ?? 'Unknown theme'} · {set.totalParts} documented non-spare units in this fixture inventory.</p>
    <section className="panel"><h2>Documented parts</h2><div className="table-wrap"><table><thead><tr><th>Part</th><th className="number">Quantity</th></tr></thead><tbody>{set.parts.map((part) => <tr key={part.id}><td><Link href={`/parts/${part.slug}/`}>{part.name} <small>{part.id}</small></Link></td><td className="number">{part.quantity}</td></tr>)}</tbody></table></div></section>
    <p className="source-note">Data sourced from Rebrickable. Updated {set.updatedAt.slice(0, 10)}.</p>
  </div>;
}
