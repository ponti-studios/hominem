import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, makeStyles } from '~/theme';

import { API_BASE_URL } from './constants';

const API_STATUS_PATH = '/api/status';
const API_HEALTH_TIMEOUT_MS = 5000;
const API_RECONNECT_POLL_MS = 10_000;

type ApiConnectionStatus = 'connected' | 'reconnecting';

type ApiConnectionContextValue = {
  status: ApiConnectionStatus;
  isReconnecting: boolean;
  pingApiNow: () => void;
};

const ApiConnectionContext = createContext<ApiConnectionContextValue | null>(null);

function getApiStatusUrl() {
  return new URL(API_STATUS_PATH, API_BASE_URL).toString();
}

function isObservedApiRequest(requestUrl: string) {
  return requestUrl.startsWith(API_BASE_URL) && requestUrl !== getApiStatusUrl();
}

async function probeApi(signal: AbortSignal) {
  const response = await fetch(getApiStatusUrl(), {
    method: 'GET',
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`API status probe failed (${response.status})`);
  }
}

export function ApiConnectionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<ApiConnectionStatus>('connected');
  const [retryTick, setRetryTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCheckingRef = useRef(false);
  const isMountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pingApiNow = useCallback(async () => {
    if (isCheckingRef.current) {
      return;
    }

    isCheckingRef.current = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_HEALTH_TIMEOUT_MS);

    try {
      await probeApi(controller.signal);
      if (!isMountedRef.current) {
        return;
      }

      setStatus('connected');
      setRetryTick(0);
      clearTimer();
    } catch {
      if (!isMountedRef.current) {
        return;
      }

      setStatus('reconnecting');
      setRetryTick((current) => current + 1);
    } finally {
      clearTimeout(timeoutId);
      isCheckingRef.current = false;
    }
  }, [clearTimer]);

  useEffect(() => {
    void pingApiNow();

    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const request = args[0];
      const requestUrl =
        typeof request === 'string'
          ? request
          : request instanceof Request
            ? request.url
            : String(request);

      try {
        const response = await originalFetch(...args);
        if (isObservedApiRequest(requestUrl) && response.status >= 500) {
          void pingApiNow();
        }
        return response;
      } catch (error) {
        if (isObservedApiRequest(requestUrl)) {
          void pingApiNow();
        }
        throw error;
      }
    }) as typeof fetch;

    return () => {
      isMountedRef.current = false;
      clearTimer();
      globalThis.fetch = originalFetch;
    };
  }, [clearTimer, pingApiNow]);

  useEffect(() => {
    if (status !== 'reconnecting') {
      clearTimer();
      return;
    }

    clearTimer();
    timerRef.current = setTimeout(() => {
      void pingApiNow();
    }, API_RECONNECT_POLL_MS);

    return clearTimer;
  }, [clearTimer, pingApiNow, retryTick, status]);

  const value = useMemo<ApiConnectionContextValue>(
    () => ({
      status,
      isReconnecting: status === 'reconnecting',
      pingApiNow,
    }),
    [pingApiNow, status],
  );

  return <ApiConnectionContext.Provider value={value}>{children}</ApiConnectionContext.Provider>;
}

function useApiConnection() {
  const context = useContext(ApiConnectionContext);
  if (!context) {
    throw new Error('useApiConnection must be used within ApiConnectionProvider');
  }

  return context;
}

export function ApiReconnectChip() {
  const { isReconnecting } = useApiConnection();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const [pulseOn, setPulseOn] = useState(false);

  useEffect(() => {
    if (!isReconnecting) {
      setPulseOn(false);
      return;
    }

    const interval = setInterval(() => {
      setPulseOn((current) => !current);
    }, 900);

    return () => {
      clearInterval(interval);
    };
  }, [isReconnecting]);

  if (!isReconnecting) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      testID="api-reconnect-chip"
      style={[styles.chip, { top: insets.top + 8, right: 8 }]}
    >
      <View
        style={[
          styles.sparkle,
          {
            opacity: pulseOn ? 1 : 0.45,
            transform: [{ scale: pulseOn ? 1.18 : 0.9 }],
          },
        ]}
      />
      <Text variant="small" color="foreground" numberOfLines={1} style={styles.copy}>
        Warming up the API · retrying in 10s
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    chip: {
      position: 'absolute',
      zIndex: 50,
      elevation: 50,
      flexDirection: 'row',
      alignItems: 'center',
      maxWidth: '82%',
      paddingHorizontal: t.spacing.sm_12,
      paddingVertical: t.spacing.xs_4,
      borderRadius: t.borderRadii.full,
      borderWidth: 1,
      borderColor: t.colors['border-default'],
      backgroundColor: t.colors['bg-surface'],
    },
    sparkle: {
      width: 7,
      height: 7,
      borderRadius: t.borderRadii.full,
      marginRight: t.spacing.xs_4,
      backgroundColor: '#F5B301',
    },
    copy: {},
  }),
);
