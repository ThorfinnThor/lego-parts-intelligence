import sourceConfig from '../../config/data-sources.json';
import rawLegalConfig from '../../config/legal-release.json';
import { legalReleaseConfigSchema } from '../../packages/data-contracts/src/index';

export function AdSlot() {
  const enabled = process.env.ENABLE_DISPLAY_ADS === 'true';
  const legalConfig = legalReleaseConfigSchema.parse(rawLegalConfig);
  if (enabled && (
    sourceConfig.displayAds !== 'approved'
    || legalConfig.status !== 'approved'
    || !legalConfig.commercialization.displayAds
  )) {
    throw new Error('Display ads cannot be enabled until the source and legal commercialization gates are approved.');
  }
  return null;
}
