import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { getRanking, getRankingPageParams } from '@/lib/data/static-catalogue';

export const dynamic = 'force-static';
export const revalidate = false;
export const dynamicParams = false;
export function generateStaticParams() { return getRankingPageParams(); }

export async function generateMetadata({ params }: { params: Promise<{ rankingSlug: string }> }): Promise<Metadata> {
  const { rankingSlug } = await params;
  const ranking = getRanking(rankingSlug);
  return ranking ? { title: ranking.title, description: ranking.description, alternates: { canonical: `/rankings/${ranking.slug}/` } } : {};
}

export default async function RankingPage({ params }: { params: Promise<{ rankingSlug: string }> }) {
  const { rankingSlug } = await params;
  const ranking = getRanking(rankingSlug);
  if (!ranking) notFound();
  return <div className="shell page-shell">
    <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Rankings' }, { label: ranking.title }]} />
    <p className="eyebrow">Catalogue ranking · {ranking.methodologyVersion}</p><h1>{ranking.title}</h1><p className="lede">{ranking.description}</p>
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Part</th><th className="number">Sets</th><th className="number">Signal</th></tr></thead><tbody>{ranking.rows.map((row) => <tr key={row.id}><td>{row.rank}</td><td><Link href={`/parts/${row.slug}/`}>{row.name} <small>{row.id}</small></Link></td><td className="number">{row.setCount}</td><td className="number">{row.score === undefined ? '—' : Math.round(row.score * 100)}</td></tr>)}</tbody></table></div></section>
    <p className="source-note">Data sourced from Rebrickable. Updated {ranking.updatedAt.slice(0, 10)}.</p>
  </div>;
}
