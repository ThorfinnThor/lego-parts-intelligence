import type { Metadata } from 'next';
import rawLegalConfig from '@/config/legal-release.json';
import { legalReleaseConfigSchema } from '@/packages/data-contracts/src/index';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

export const dynamic = 'force-static';
export const revalidate = false;
export const metadata: Metadata = { title: 'Legal and commercial disclosures', alternates: { canonical: '/legal/' } };

export default function LegalPage() {
  const legal = legalReleaseConfigSchema.parse(rawLegalConfig);

  return (
    <article className="shell page-shell prose">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Legal' }]} />
      <p className="eyebrow">{legal.status === 'approved' ? 'Operator-approved disclosure' : 'Pre-launch legal gate'}</p>
      <h1>Legal and commercial disclosures</h1>
      {legal.status === 'approved' ? (
        <>
          <p>Operated by {legal.operatorName}. Contact: <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>.</p>
          <p><a href={legal.imprintUrl}>Imprint</a> · <a href={legal.privacyUrl}>Privacy policy</a></p>
          <p>Reviewed on {legal.reviewedAt}; next review due {legal.reviewDueAt}. Approval owner: {legal.approvedBy}.</p>
        </>
      ) : (
        <p>Production remains technically blocked until the operator-approved imprint, privacy policy, contact details, and review record are configured.</p>
      )}
      <h2>Current commercial state</h2>
      <p>Display advertising and affiliate links are disabled. Any future affiliate link must identify its partner, include an appropriate disclosure, and use sponsored/nofollow attributes where required.</p>
      <h2>Trademark</h2>
      <p>{legal.trademarkNotice}</p>
    </article>
  );
}
