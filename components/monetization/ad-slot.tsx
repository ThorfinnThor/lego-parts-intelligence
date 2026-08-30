import sourceConfig from '../../config/data-sources.json';

export function AdSlot() {
  const enabled = process.env.ENABLE_DISPLAY_ADS === 'true';
  if (enabled && sourceConfig.displayAds !== 'approved') {
    throw new Error('Display ads cannot be enabled until the source/legal gate is approved.');
  }
  return null;
}
