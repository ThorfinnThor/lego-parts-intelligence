import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { getDonorData, getDonorPageParams, isPartPageAvailable, isSetPageAvailable } from '@/lib/data/static-catalogue';

export const dynamic = 'force-static';
export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() { return getDonorPageParams(); }

export async function generateMetadata({ params }: { params: Promise<{ partSlug: string }> }): Promise<Metadata> {
  const { partSlug } = await params;
  const data = getDonorData(partSlug);
  if (!data) return {};
  return {
    title: `Inventory donor sets for ${data.partName} (${data.partId})`,
    description: `Compare sets containing ${data.partName} using transparent inventory-only donor scoring. No prices are included.`,
    alternates: { canonical: `/donor-sets/${partSlug}/` },
    robots: data.indexable ? undefined : { index: false, follow: true },
  };
}

export default async function DonorPage({ params }: { params: Promise<{ partSlug: string }> }) {
  const { partSlug } = await params;
  const data = getDonorData(partSlug);
  if (!data) notFound();
  return (
    <div className="shell page-shell">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Parts', href: '/parts/' }, { label: data.partName, ...(isPartPageAvailable(data.partSlug) ? { href: `/parts/${data.partSlug}/` } : {}) }, { label: 'Donor sets' }]} />
      <p className="eyebrow">Inventory Donor Score · donor-v1</p>
      <h1>Donor sets for {data.partName}</h1>
      <p className="lede">These sets are ranked by documented target quantity, part density, reusable common inventory, and inventory diversity. Price and availability are not considered.</p>
      <div className="notice"><strong>Interpretation boundary</strong><span>A higher score means stronger catalogue inventory fit—not a cheaper or better purchase.</span></div>
      <section className="panel">
        <div className="table-wrap"><table><thead><tr><th>Rank</th><th>Set</th><th>Year</th><th className="number">Target qty.</th><th className="number">Total units</th><th className="number">Density</th><th className="number">Score</th></tr></thead><tbody>
          {data.candidates.map((candidate, index) => <tr key={candidate.setId}><td>{index + 1}</td><td>{isSetPageAvailable(candidate.setSlug) ? <Link href={`/sets/${candidate.setSlug}/`}>{candidate.setName} <small>{candidate.setId}</small></Link> : <>{candidate.setName} <small>{candidate.setId}</small></>}</td><td>{candidate.year ?? '—'}</td><td className="number">{candidate.targetQuantity}</td><td className="number">{candidate.setTotalParts}</td><td className="number">{Math.round(candidate.partDensity * 100)}%</td><td className="number"><strong>{Math.round(candidate.inventoryDonorScore * 100)}</strong></td></tr>)}
        </tbody></table></div>
      </section>
      <p><Link className="text-link" href="/methodology/donor-score/">See the complete scoring formula and limitations →</Link></p>
      <p className="source-note">Data sourced from Rebrickable. Methodology version {data.methodologyVersion}.</p>
    </div>
  );
}
