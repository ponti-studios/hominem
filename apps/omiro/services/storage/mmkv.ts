import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'app-storage' });

export function subscribeToStorageKey(key: string, onChange: () => void) {
  const listener = storage.addOnValueChangedListener((changedKey) => {
    if (changedKey === key) {
      onChange();
    }
  });

  return () => {
    listener.remove();
  };
}
