import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

export const dynamic = 'force-static';
export const revalidate = false;
export const metadata: Metadata = { title: 'Inventory Donor Score methodology', alternates: { canonical: '/methodology/donor-score/' } };

export default function DonorMethodologyPage() {
  return <article className="shell page-shell prose"><Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Methodology' }, { label: 'Donor score' }]} /><p className="eyebrow">Methodology · donor-v1</p><h1>Inventory Donor Score</h1><p className="lede">A transparent heuristic for ranking sets that contain a target part. It deliberately excludes price, condition, shipping, and market availability.</p><h2>Formula</h2><pre><code>0.60 × normalized target quantity{`\n`}+ 0.20 × normalized part density{`\n`}+ 0.10 × reusable common inventory ratio{`\n`}+ 0.10 × inventory diversity</code></pre><h2>How to read it</h2><p>Scores are normalized within the candidate sets for one part. A score of 80 for one part is not directly comparable to 80 for another part.</p><h2>What it does not claim</h2><p>The score is not “best value,” “cheapest,” or a buying recommendation. It only describes inventory fit in the pinned catalogue snapshot.</p><p><Link href="/rankings/most-common-parts/">Explore catalogue rankings →</Link></p></article>;
}
