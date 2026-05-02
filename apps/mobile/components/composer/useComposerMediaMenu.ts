import { useCallback, useState } from 'react';
import { ActionSheetIOS } from 'react-native';

import t from '~/translations';

interface UseComposerMediaMenuOptions {
  pickAttachment: () => void | Promise<unknown>;
}

export function useComposerMediaMenu({ pickAttachment }: UseComposerMediaMenuOptions) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const showPlusMenu = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          t.chat.input.actionSheet.cancel,
          t.chat.input.actionSheet.takePhoto,
          t.chat.input.actionSheet.chooseFromLibrary,
        ],
        cancelButtonIndex: 0,
      },
      (i) => {
        if (i === 1) setIsCameraOpen(true);
        else if (i === 2) void pickAttachment();
      },
    );
  }, [pickAttachment]);

  return {
    isCameraOpen,
    setIsCameraOpen,
    showPlusMenu,
  };
}
