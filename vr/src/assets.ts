import { AssetType, defineAssets } from '@iwsdk/core';

// The asset catalog. It is read by the app and by the editor, so it must stay
// free of side effects. Panels are UIKitML files in public/ui.
const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

export default defineAssets({
  chime: {
    url: publicAssetUrl('audio/chime.mp3'),
    type: AssetType.Audio,
    name: 'Chime',
    priority: 'lazy',
  },
});
