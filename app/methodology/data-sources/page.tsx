import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import source from '../../../config/data-sources.json';

export const dynamic = 'force-static';
export const revalidate = false;
export const metadata: Metadata = { title: 'Data sources and rights', alternates: { canonical: '/methodology/data-sources/' } };

export default function DataSourcesPage() {
  return <article className="shell page-shell prose"><Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Methodology' }, { label: 'Data sources' }]} /><p className="eyebrow">Source governance</p><h1>Data sources and rights</h1><p className="lede">Data sourced from Rebrickable. The commercial catalogue-data basis has been reviewed; image and monetization gates remain closed.</p><dl className="definition-list"><div><dt>Source status</dt><dd>{source.status}</dd></div><div><dt>Commercial catalogue data</dt><dd>{source.catalogCommercialUse ? 'allowed by Rebrickable terms' : 'blocked'}</dd></div><div><dt>Set, part, and minifigure images</dt><dd>{source.externalSetPartMinifigImages ? 'enabled' : 'disabled pending written LEGO permission'}</dd></div><div><dt>Terms reviewed</dt><dd>{source.reviewedAt}</dd></div><div><dt>Next review due</dt><dd>{source.reviewDueAt}</dd></div><div><dt>MOC images</dt><dd>Never exported</dd></div><div><dt>Display ads</dt><dd>{source.displayAds}</dd></div><div><dt>Affiliate links</dt><dd>{source.affiliateLinks}</dd></div><div><dt>Production approval</dt><dd>{source.productionApproval ? 'approved' : 'blocked'}</dd></div></dl><p>This is a technical policy record, not legal advice. Production and monetization stay disabled until the remaining LEGO intellectual-property permission and operator legal review are documented.</p></article>;
}
