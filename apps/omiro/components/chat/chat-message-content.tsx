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
  streaming = false,
  textStyle,
  children,
}: {
  content: string;
  enableMarkdown: boolean;
  /** An assistant reply still arriving: shown as unformatted streaming text. */
  streaming?: boolean;
  textStyle: object;
  children?: ReactNode;
}) {
  const Markdown = useMarkdownComponent();
  const isStreaming = !enableMarkdown;
  const { foreground: textPrimary, popover, primary, border } = useAppTheme().colors;
  const { borderRadii } = useAppTheme();

  const markdownStyle = useMemo(
    () => ({
      body: textStyle,
      text: textStyle,
      textgroup: textStyle,
      strong: { fontWeight: '700' as const },
      em: { fontStyle: 'italic' as const },
      s: { textDecorationLine: 'line-through' as const },
      link: { color: primary, textDecorationLine: 'underline' as const },
      // Headings stay near body size: this is chat, not a document.
      heading1: {
        ...textStyle,
        fontSize: 22,
        lineHeight: 28,
        fontWeight: '700' as const,
        marginTop: 6,
        marginBottom: 8,
      },
      heading2: {
        ...textStyle,
        fontSize: 19,
        lineHeight: 25,
        fontWeight: '700' as const,
        marginTop: 6,
        marginBottom: 6,
      },
      heading3: {
        ...textStyle,
        fontSize: 17,
        lineHeight: 24,
        fontWeight: '600' as const,
        marginTop: 4,
        marginBottom: 4,
      },
      heading4: {
        ...textStyle,
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '600' as const,
        marginTop: 4,
        marginBottom: 4,
      },
      heading5: {
        ...textStyle,
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '600' as const,
        marginBottom: 4,
      },
      heading6: {
        ...textStyle,
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '600' as const,
        marginBottom: 4,
      },
      bullet_list: { marginBottom: 10 },
      ordered_list: { marginBottom: 10 },
      list_item: { flexDirection: 'row' as const, marginBottom: 4 },
      bullet_list_icon: { ...textStyle, marginLeft: 4, marginRight: 8 },
      ordered_list_icon: { ...textStyle, marginLeft: 4, marginRight: 8 },
      bullet_list_content: { flex: 1 },
      ordered_list_content: { flex: 1 },
      blockquote: {
        backgroundColor: 'transparent',
        borderLeftColor: border,
        borderLeftWidth: 3,
        marginBottom: 10,
        marginLeft: 0,
        paddingHorizontal: 12,
        paddingVertical: 2,
      },
      hr: { backgroundColor: border, height: 1, marginVertical: 12 },
      table: { borderColor: border, borderRadius: borderRadii.lg, marginBottom: 10 },
      th: { padding: 8, fontWeight: '600' as const },
      td: { padding: 8 },
      tr: { borderColor: border },
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
    [textPrimary, popover, primary, border, textStyle, borderRadii.lg],
  );
  const markdownChildren = { children: content };

  return (
    <View style={styles.content}>
      {streaming ? (
        <Text style={textStyle}>{content}</Text>
      ) : isStreaming || !Markdown ? (
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
