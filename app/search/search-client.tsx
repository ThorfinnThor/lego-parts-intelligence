'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import MiniSearch, { type SearchResult } from 'minisearch';
import type { SearchDocumentV1 } from '../../packages/data-contracts/src/index';

export function SearchClient() {
  const [documents, setDocuments] = useState<SearchDocumentV1[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/data/search-index/catalogue.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Search index returned ${response.status}`);
        return response.json() as Promise<SearchDocumentV1[]>;
      })
      .then(setDocuments)
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(true);
      });
    return () => controller.abort();
  }, []);

  const search = useMemo(() => {
    const index = new MiniSearch<SearchDocumentV1>({
      fields: ['name', 'number', 'category', 'theme'],
      storeFields: ['name', 'number', 'slug', 'type', 'category', 'theme', 'year'],
      searchOptions: { boost: { number: 3, name: 2 }, fuzzy: 0.2, prefix: true },
    });
    index.addAll(documents);
    return index;
  }, [documents]);

  const results = query.trim().length > 0 ? search.search(query).slice(0, 24) : [];
  return (
    <div>
      <label className="search-label" htmlFor="catalogue-search">Part or set name/number</label>
      <input id="catalogue-search" className="search-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try 3001 or Brick 2 x 4" autoComplete="off" />
      <p className="search-status" role="status">{error ? 'The static index could not be loaded.' : query ? `${results.length} result${results.length === 1 ? '' : 's'}` : `${documents.length} records ready`}</p>
      <div className="search-results">
        {results.map((result) => <SearchResultCard key={`${result.type}-${result.id}`} result={result} />)}
      </div>
    </div>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const type = result.type === 'set' ? 'set' : 'part';
  const href = type === 'set' ? `/sets/${String(result.slug)}/` : `/parts/${String(result.slug)}/`;
  return <article className="search-result"><span>{type}</span><h2><Link href={href}>{String(result.name)}</Link></h2><p>{String(result.number)}{result.category ? ` · ${String(result.category)}` : ''}{result.theme ? ` · ${String(result.theme)}` : ''}</p></article>;
}
