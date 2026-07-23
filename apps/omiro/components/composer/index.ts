import { ComposerMedia } from '~/components/composer/ComposerMedia';
import { ComposerShell } from '~/components/composer/ComposerShell';
import { ComposerTextInput } from '~/components/composer/ComposerTextInput';
import { ComposerToolbar } from '~/components/composer/ComposerToolbar';

// Named ComposerKit, not Composer, to avoid colliding with the existing
// mode-switching `Composer` screen component in Composer.tsx.
export const ComposerKit = Object.assign(ComposerShell, {
  Input: ComposerTextInput,
  Toolbar: ComposerToolbar,
  Media: ComposerMedia,
});

export { useComposerController } from '~/components/composer/useComposerController';
export * from '~/components/composer/constants';
