import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles } from '~/components/theme';
import { PageHeader } from '~/components/ui/PageHeader';

interface AuthLayoutProps {
  testID: string;
  title: string;
  helper: string;
  isProbing?: boolean;
  children: React.ReactNode;
}

export function AuthLayout({ testID, title, helper, isProbing, children }: AuthLayoutProps) {
  const styles = useStyles();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <View style={styles.container} testID={testID}>
          <Animated.View entering={FadeInDown.delay(0).duration(150)}>
            <PageHeader
              title={title}
              description={isProbing ? 'Resuming session…' : helper}
            />
          </Animated.View>

          {!isProbing && (
            <Animated.View
              entering={FadeInDown.delay(100).duration(150)}
              style={styles.form}
            >
              {children}
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    container: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: t.spacing.ml_24,
      paddingBottom: t.spacing.ml_24,
      rowGap: t.spacing.ml_24,
    },
    form: {
      width: '100%',
    },
  }),
);
