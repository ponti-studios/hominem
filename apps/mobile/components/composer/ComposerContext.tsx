import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import type { ComposerAttachment } from '~/components/composer/composerState';

interface ComposerContextValue {
  attachments: ComposerAttachment[];
  errors: string[];
  isUploading: boolean;
  progressByAssetId: Record<string, number>;
  onRemove: (id: string) => void;
  seedMessage?: string;
  setAttachments: React.Dispatch<React.SetStateAction<ComposerAttachment[]>>;
  setErrors: React.Dispatch<React.SetStateAction<string[]>>;
  setIsUploading: (value: boolean | ((prev: boolean) => boolean)) => void;
  setProgressByAssetId: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setOnRemove: (fn: (id: string) => void) => void;
}

const ComposerContext = createContext<ComposerContextValue | undefined>(undefined);

interface ComposerProviderProps {
  children: React.ReactNode;
  seedMessage?: string;
}

export function ComposerProvider({ children, seedMessage }: ComposerProviderProps) {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progressByAssetId, setProgressByAssetId] = useState<Record<string, number>>({});
  const onRemoveRef = useRef<(id: string) => void>(() => {});

  const setOnRemove = useCallback((fn: (id: string) => void) => {
    onRemoveRef.current = fn;
  }, []);

  const onRemove = useCallback((id: string) => onRemoveRef.current(id), []);

  const value = useMemo<ComposerContextValue>(
    () => ({
      attachments,
      errors,
      isUploading,
      progressByAssetId,
      onRemove,
      seedMessage,
      setAttachments,
      setErrors,
      setIsUploading,
      setProgressByAssetId,
      setOnRemove,
    }),
    [attachments, errors, isUploading, progressByAssetId, onRemove, seedMessage, setOnRemove],
  );

  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>;
}

export function useComposerContext() {
  const context = useContext(ComposerContext);
  if (!context) {
    throw new Error('useComposerContext must be used within a ComposerProvider');
  }
  return context;
}

export function useComposerAttachments() {
  const context = useContext(ComposerContext);
  if (!context) {
    throw new Error('useComposerAttachments must be used within a ComposerProvider');
  }
  return {
    attachments: context.attachments,
    errors: context.errors,
    isUploading: context.isUploading,
    progressByAssetId: context.progressByAssetId,
    onRemove: context.onRemove,
  };
}

