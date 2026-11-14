import { AssetType, defineAssets } from '@iwsdk/core';

// The asset catalog. It is read by the app and by the editor, so it must stay
// free of side effects. Panels are UIKitML files in public/ui.
const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export const PANEL_URLS = {
  menu: publicAssetUrl('ui/menu.uikitml'),
  focus: publicAssetUrl('ui/focus.uikitml'),
  report: publicAssetUrl('ui/report.uikitml'),
  card: publicAssetUrl('ui/card.uikitml'),
} as const;

export default defineAssets({
  'menu-panel': uikitml('menu.uikitml', 'Plan picker'),
  'focus-panel': uikitml('focus.uikitml', 'Timer'),
  'report-panel': uikitml('report.uikitml', 'Report'),
  'card-panel': uikitml('card.uikitml', 'Task card'),
});
