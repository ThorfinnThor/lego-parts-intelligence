import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import source from '../../../config/data-sources.json';

export const dynamic = 'force-static';
export const revalidate = false;
export const metadata: Metadata = { title: 'Data sources and rights', alternates: { canonical: '/methodology/data-sources/' } };

export default function DataSourcesPage() {
  return <article className="shell page-shell prose"><Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Methodology' }, { label: 'Data sources' }]} /><p className="eyebrow">Source governance</p><h1>Data sources and rights</h1><p className="lede">Data sourced from Rebrickable. Public releases are blocked unless machine-readable commercial-use and image-policy gates pass.</p><dl className="definition-list"><div><dt>Source status</dt><dd>{source.status}</dd></div><div><dt>Terms reviewed</dt><dd>{source.reviewedAt}</dd></div><div><dt>Next review due</dt><dd>{source.reviewDueAt}</dd></div><div><dt>MOC images</dt><dd>Never exported</dd></div><div><dt>Display ads</dt><dd>{source.displayAds}</dd></div><div><dt>Production approval</dt><dd>{source.productionApproval ? 'approved' : 'pending operator/legal review'}</dd></div></dl><p>This repository implements technical gates; it does not substitute for legal review. Commercial production launch stays disabled until an operator records approval.</p></article>;
}
