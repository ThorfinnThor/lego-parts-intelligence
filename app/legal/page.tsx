import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

export const dynamic = 'force-static';
export const revalidate = false;
export const metadata: Metadata = { title: 'Legal and commercial disclosures', alternates: { canonical: '/legal/' } };

export default function LegalPage() { return <article className="shell page-shell prose"><Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Legal' }]} /><p className="eyebrow">Launch placeholder</p><h1>Legal and commercial disclosures</h1><p>This page must be replaced with operator-approved imprint, privacy, trademark, and commercial disclosures before production launch.</p><h2>Current commercial state</h2><p>Display advertising and affiliate links are disabled. Any future affiliate link must identify its partner, include an appropriate disclosure, and use sponsored/nofollow attributes where required.</p><h2>Trademark</h2><p>This independent project is not affiliated with, authorized by, or endorsed by the LEGO Group. LEGO is a trademark of the LEGO Group.</p></article>; }
