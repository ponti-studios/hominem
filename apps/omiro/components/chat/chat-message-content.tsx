import { logger } from '@hominem/telemetry';
import {
  createElement,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fontFamilies, useAppTheme } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { useStreamingMessageText } from '~/services/chat/streaming-text-store';
import { countRender } from '~/services/perf/stream-perf';

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

// Start loading the markdown renderer before any chat is open, so the first
// committed reply doesn't wait on the module before it can swap in.
export function preloadMarkdown(): void {
  void getMarkdownComponent();
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

const MARK_HOLD_MS = 160;
const MARK_FADE_MS = 640;
const MARK_TICK_MS = 80;

type Mark = { from: number; to: number; at: number };

// Lime at `alpha`, as an 8-digit hex so it composes over either theme surface.
function withAlpha(hex: string, alpha: number) {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

// The marker: whatever just arrived is highlighted lime, held a beat, then the
// highlight wipes away. The text is one <Text> with nested spans, so the reply
// stays a single bubble and nothing reflows as the highlight changes.
function StreamingMessageText({ id, textStyle }: { id: string; textStyle: object }) {
  const text = useStreamingMessageText(id);
  const { lime, limeForeground } = useAppTheme().colors;
  const reducedMotion = useReducedMotion();
  const [marks, setMarks] = useState<Mark[]>([]);
  const seen = useRef(0);
  const [now, setNow] = useState(0);
  countRender('StreamingMessageText');

  // Layout effect: the new word is marked before the frame it first shows in.
  useLayoutEffect(() => {
    const at = Date.now();
    if (text.length > seen.current) {
      const mark = { from: seen.current, to: text.length, at };
      setMarks((current) => [...current, mark]);
      setNow(at);
    } else if (text.length < seen.current) {
      setMarks([]);
    }
    seen.current = text.length;
  }, [text]);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      setMarks((current) => {
        const next = current.filter((mark) => at - mark.at < MARK_HOLD_MS + MARK_FADE_MS);
        return next.length === current.length ? current : next;
      });
    }, MARK_TICK_MS);
    return () => clearInterval(timer);
  }, [reducedMotion]);

  const live = reducedMotion ? [] : marks;

  const spans: ReactNode[] = [];
  let cursor = 0;
  for (const mark of live) {
    if (mark.from > cursor) {
      spans.push(text.slice(cursor, mark.from));
    }
    const age = Math.max(0, now - mark.at);
    const alpha = age <= MARK_HOLD_MS ? 1 : 1 - (age - MARK_HOLD_MS) / MARK_FADE_MS;
    spans.push(
      <Text
        key={mark.at + ':' + mark.from}
        style={{
          backgroundColor: withAlpha(lime, alpha),
          color: alpha > 0.35 ? limeForeground : undefined,
        }}
      >
        {text.slice(mark.from, mark.to)}
      </Text>,
    );
    cursor = mark.to;
  }
  spans.push(text.slice(cursor));

  // Nothing yet: render no empty line, so the thinking indicator sits flush in the bubble.
  if (!text) {
    return null;
  }
  return <Text style={textStyle}>{spans}</Text>;
}

export function MessageContent({
  content,
  enableMarkdown,
  streamingId,
  textStyle,
  children,
}: {
  content: string;
  enableMarkdown: boolean;
  /** An assistant reply still arriving: its text is read live from the streaming store. */
  streamingId?: string;
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
      {streamingId ? (
        <StreamingMessageText id={streamingId} textStyle={textStyle} />
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
