import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

export const dynamic = 'force-static';
export const revalidate = false;
export const metadata: Metadata = { title: 'About', alternates: { canonical: '/about/' } };

export default function AboutPage() { return <article className="shell page-shell prose"><Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'About' }]} /><p className="eyebrow">Independent project</p><h1>Useful catalogue answers, carefully bounded</h1><p>Parts Intelligence turns public catalogue records into navigable part, color, occurrence, and donor-set views. Every score is versioned and explained; unsupported price or compatibility claims are intentionally absent.</p><p>The site is not affiliated with, authorized by, or endorsed by the LEGO Group. LEGO is a trademark of the LEGO Group.</p></article>; }
