import type { Metadata } from 'next';
import { AdSlot } from '@/components/monetization/ad-slot';
import { SiteFooter } from '@/components/navigation/site-footer';
import { SiteHeader } from '@/components/navigation/site-header';
import './globals.css';

const baseUrl = process.env.APP_BASE_URL ?? 'https://example.com';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: { default: 'Parts Intelligence', template: '%s · Parts Intelligence' },
  description: 'Explore parts, set occurrences, colors, relationships, and transparent inventory donor rankings.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <AdSlot />
        <SiteFooter />
      </body>
    </html>
  );
}
