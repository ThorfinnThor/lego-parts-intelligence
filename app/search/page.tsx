import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { SearchClient } from './search-client';

export const dynamic = 'force-static';
export const revalidate = false;
export const metadata: Metadata = { title: 'Search the catalogue', alternates: { canonical: '/search/' } };

export default function SearchPage() {
  return <div className="shell page-shell narrow"><Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Search' }]} /><p className="eyebrow">Local static index</p><h1>Search parts, sets, and minifigures</h1><p className="lede">Search runs in your browser against a small, versioned index. No query is sent to a catalogue database.</p><SearchClient /></div>;
}
