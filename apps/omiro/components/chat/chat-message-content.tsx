import { logger } from '@hominem/telemetry';
import { createElement, type ReactNode, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fontFamilies, useAppTheme } from '~/components/theme';

type MarkdownComponent = typeof import('react-native-markdown-display').default;

async function loadMarkdown() {
  const mod = await import('react-native-markdown-display');
  return mod.default;
}

let markdownPromise: Promise<MarkdownComponent | null> | null = null;

function getMarkdownComponent(): Promise<MarkdownComponent | null> {
  if (!markdownPromise) {
    markdownPromise = loadMarkdown().catch((error) => {
      markdownPromise = null;
      logger.warn('[MessageContent] Failed to load react-native-markdown-display', { error });
      return null;
    });
  }
  return markdownPromise;
}

function useMarkdownComponent(): MarkdownComponent | null {
  const [Markdown, setMarkdown] = useState<MarkdownComponent | null>(null);

  useEffect(() => {
    let active = true;
    void getMarkdownComponent().then((component) => {
      if (active) {
        setMarkdown(component);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return Markdown;
}

export function MessageContent({
  content,
  enableMarkdown,
  textStyle,
  children,
}: {
  content: string;
  enableMarkdown: boolean;
  textStyle: object;
  children?: ReactNode;
}) {
  const Markdown = useMarkdownComponent();
  const isStreaming = !enableMarkdown;
  const { foreground: textPrimary, popover } = useAppTheme().colors;
  const { borderRadii } = useAppTheme();

  const markdownStyle = useMemo(
    () => ({
      body: textStyle,
      // Paragraph spacing comes from the bottom margin only; the trailing one
      // is cancelled by the wrapper below so the bubble hugs the text.
      paragraph: { marginBottom: 10, marginTop: 0 },
      code_block: {
        backgroundColor: popover,
        borderRadius: borderRadii.lg,
        color: textPrimary,
        fontFamily: fontFamilies.mono,
        padding: 12,
      },
      code_inline: {
        backgroundColor: popover,
        borderRadius: 4,
        color: textPrimary,
        fontFamily: fontFamilies.mono,
        paddingHorizontal: 4,
      },
      fence: {
        backgroundColor: popover,
        borderRadius: borderRadii.lg,
        color: textPrimary,
        fontFamily: fontFamilies.mono,
        padding: 12,
      },
    }),
    [textPrimary, popover, textStyle, borderRadii.lg],
  );
  const markdownChildren = { children: content };

  return (
    <View style={styles.content}>
      {isStreaming || !Markdown ? (
        <Text style={textStyle}>{content}</Text>
      ) : (
        <View style={styles.markdown}>
          {createElement(Markdown, { style: markdownStyle, ...markdownChildren })}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  markdown: { marginBottom: -10 },
});
