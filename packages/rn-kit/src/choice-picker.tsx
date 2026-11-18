import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from 'react-native';

import { ChoiceList, type ChoiceListColors, type ChoiceOption } from './choice-list';
import { FormFooter } from './form';

export type ChoicePickerColors = ChoiceListColors & { background: string };

/** What the close control needs from the picker: where a tap goes and what it is called. */
export interface CloseControlProps {
  onPress: () => void;
  label: string;
}

/** What every picker needs to say and do, whether it sits in a sheet of its own or inside one. */
export interface ChoicePickerContent<T extends string = string> {
  title: string;
  /** The accessibility label of the corner close button. */
  closeLabel: string;
  choices: readonly ChoiceOption<T>[];
  selected: T;
  /** Tapping a row picks it. The picker stays open, so the person can see the change. */
  onSelect: (id: T) => void;
  footer?: string;
  colors: ChoicePickerColors;
  /** Lets an app set its own title face. Defaults to the body face. */
  titleStyle?: TextStyle;
  /** Lets an app draw its own close control (for example, a glass one). Defaults to a plain circle. */
  renderClose?: (props: CloseControlProps) => ReactNode;
  testIDPrefix?: string;
}

/** The round ✕ in the top corner. Its fill is a translucent wash, so it reads on light and dark. */
export function CloseButton({
  onPress,
  label,
  foreground,
}: CloseControlProps & { foreground: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={styles.closeCircle}
    >
      <Text style={[styles.closeGlyph, { color: foreground }]}>✕</Text>
    </Pressable>
  );
}

/** The title and the corner close control, the top of every picker. */
export function PickerHeader({
  title,
  closeLabel,
  onClose,
  colors,
  titleStyle,
  renderClose,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  colors: Pick<ChoicePickerColors, 'foreground'>;
  titleStyle?: TextStyle;
  renderClose?: (props: CloseControlProps) => ReactNode;
}) {
  const close = { onPress: onClose, label: closeLabel };
  return (
    <View style={styles.header}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.foreground }, titleStyle]}
      >
        {title}
      </Text>
      {renderClose ? renderClose(close) : <CloseButton {...close} foreground={colors.foreground} />}
    </View>
  );
}

/** The rows and the footer. No scroll and no header, so it can sit inside any scroll view. */
export function ChoicePickerBody<T extends string>({
  choices,
  selected,
  onSelect,
  footer,
  colors,
  title,
  testIDPrefix,
}: Pick<
  ChoicePickerContent<T>,
  'choices' | 'selected' | 'onSelect' | 'footer' | 'colors' | 'title' | 'testIDPrefix'
>) {
  return (
    <View style={styles.body}>
      <ChoiceList
        options={choices}
        selectedId={selected}
        onSelect={onSelect}
        colors={colors}
        checkPosition="leading"
        accessibilityLabel={title}
        testIDPrefix={testIDPrefix}
      />
      {footer ? <FormFooter text={footer} colors={colors} /> : null}
    </View>
  );
}

/**
 * A picker that lives inside a sheet the app already has open (for example, a settings sheet that
 * swaps to it). It draws no modal of its own, and it does not scroll: the sheet around it does.
 */
export function ChoicePickerView<T extends string>({
  onClose,
  ...content
}: ChoicePickerContent<T> & { onClose: () => void }) {
  return (
    <View style={styles.inline}>
      <PickerHeader
        title={content.title}
        closeLabel={content.closeLabel}
        onClose={onClose}
        colors={content.colors}
        titleStyle={content.titleStyle}
        renderClose={content.renderClose}
      />
      <ChoicePickerBody
        choices={content.choices}
        selected={content.selected}
        onSelect={content.onSelect}
        footer={content.footer}
        colors={content.colors}
        title={content.title}
        testIDPrefix={content.testIDPrefix}
      />
    </View>
  );
}

const SLIDE_DISTANCE = 480;

/**
 * A bottom sheet of a few named options, on its own. It is only as tall as its contents (up to most
 * of the screen), slides up over a dimmed backdrop, and slides back down on close. Tapping the
 * backdrop or the close control closes it. Thames uses this; Omiro uses ChoicePickerView inside its settings sheet.
 */
export function ChoicePicker<T extends string>({
  visible,
  onClose,
  ...content
}: ChoicePickerContent<T> & { visible: boolean; onClose: () => void }) {
  // Stays mounted while the sheet slides out, then unmounts.
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, progress]);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={content.closeLabel}
          onPress={onClose}
          style={styles.backdropTouch}
        >
          <Animated.View style={[styles.backdrop, { opacity: progress }]} />
        </Pressable>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: content.colors.background },
            {
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [SLIDE_DISTANCE, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <PickerHeader
              title={content.title}
              closeLabel={content.closeLabel}
              onClose={onClose}
              colors={content.colors}
              titleStyle={content.titleStyle}
              renderClose={content.renderClose}
            />
          </View>
          {/* The content sizes the sheet. Only a long list scrolls, inside the sheet's maximum height. */}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <ChoicePickerBody
              choices={content.choices}
              selected={content.selected}
              onSelect={content.onSelect}
              footer={content.footer}
              colors={content.colors}
              title={content.title}
              testIDPrefix={content.testIDPrefix}
            />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdropTouch: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  inline: { gap: 12 },
  modalHeader: { paddingHorizontal: 24, paddingTop: 22 },
  header: {
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { flexShrink: 1, fontSize: 24, fontWeight: '600', letterSpacing: -0.3 },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127, 127, 127, 0.18)',
  },
  closeGlyph: { fontSize: 13, fontWeight: '700' },
  body: { gap: 16 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 8 },
});
