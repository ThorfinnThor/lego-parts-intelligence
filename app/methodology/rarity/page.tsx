import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

export const dynamic = 'force-static';
export const revalidate = false;
export const metadata: Metadata = { title: 'Catalogue rarity methodology', alternates: { canonical: '/methodology/rarity/' } };

export default function RarityMethodologyPage() {
  return <article className="shell page-shell prose"><Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Methodology' }, { label: 'Rarity' }]} /><p className="eyebrow">Methodology · part-stats-v1</p><h1>Catalogue commonality and rarity</h1><p className="lede">These signals describe breadth across documented sets, quantities, themes, colors, and years.</p><h2>Commonality</h2><p>Inputs are log-normalized across the current population, then weighted: sets 45%, total quantity 20%, themes 15%, colors 10%, and year span 10%.</p><h2>Rarity</h2><p>Catalogue rarity is <code>1 − commonality</code>. It is not market value, production volume, collector demand, or evidence that an element is expensive.</p></article>;
}
