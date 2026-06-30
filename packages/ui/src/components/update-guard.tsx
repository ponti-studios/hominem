import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

interface RegisterSWOptions {
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: Error) => void;
  serviceWorkerPath?: string;
}

interface RegisterSWResult {
  offlineReady: [boolean, (value: boolean) => void];
  needRefresh: [boolean, (value: boolean) => void];
  updateServiceWorker: (reload?: boolean) => void;
}

function useRegisterSW(options?: RegisterSWOptions): RegisterSWResult {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const shouldReloadRef = useRef(false);
  const hasReloadedRef = useRef(false);
  const onRegisteredRef = useRef(options?.onRegistered);
  const onRegisterErrorRef = useRef(options?.onRegisterError);
  const serviceWorkerPathRef = useRef(options?.serviceWorkerPath ?? "/sw.js");

  useEffect(() => {
    onRegisteredRef.current = options?.onRegistered;
    onRegisterErrorRef.current = options?.onRegisterError;
    serviceWorkerPathRef.current = options?.serviceWorkerPath ?? "/sw.js";
  }, [options?.onRegistered, options?.onRegisterError, options?.serviceWorkerPath]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    ) {
      return;
    }

    let isMounted = true;

    const handleControllerChange = () => {
      if (!shouldReloadRef.current || hasReloadedRef.current) {
        return;
      }

      hasReloadedRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const handleWaitingServiceWorker = (registration: ServiceWorkerRegistration) => {
      registrationRef.current = registration;
      if (!isMounted) {
        return;
      }

      setNeedRefresh(true);
      setOfflineReady(false);
    };

    const handleInstalledServiceWorker = (registration: ServiceWorkerRegistration) => {
      registrationRef.current = registration;
      if (!isMounted) {
        return;
      }

      if (navigator.serviceWorker.controller) {
        setNeedRefresh(true);
        setOfflineReady(false);
        return;
      }

      setOfflineReady(true);
    };

    const trackRegistration = (registration: ServiceWorkerRegistration) => {
      registrationRef.current = registration;
      onRegisteredRef.current?.(registration);

      if (registration.waiting) {
        handleWaitingServiceWorker(registration);
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }

        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed") {
            handleInstalledServiceWorker(registration);
          }
        });
      });
    };

    void navigator.serviceWorker
      .register(serviceWorkerPathRef.current)
      .then((registration) => {
        if (!isMounted) {
          return;
        }

        trackRegistration(registration);
        return navigator.serviceWorker.ready.then(() => {
          if (!isMounted || navigator.serviceWorker.controller) {
            return;
          }

          setOfflineReady(true);
        });
      })
      .catch((error: Error) => {
        if (isMounted) {
          onRegisterErrorRef.current?.(error);
        }
      });

    return () => {
      isMounted = false;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker: (reload = true) => {
      shouldReloadRef.current = reload;
      registrationRef.current?.waiting?.postMessage({ type: "SKIP_WAITING" });
    },
  };
}

function subscribeOnline(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot() {
  if (typeof navigator === "undefined") {
    return true;
  }

  return navigator.onLine;
}

export interface UpdateGuardCopy {
  offlineReady?: string;
  newContentAvailable?: string;
  refreshButton?: string;
  closeButton?: string;
  offlineMessage?: string;
  offlineStaleMessage?: string;
}

export interface UpdateGuardProps {
  children: ReactNode;
  serviceWorkerPath?: string;
  hasStaleData?: boolean;
  hideInDev?: boolean;
  copy?: UpdateGuardCopy;
}

function UpdateGuardClient({
  serviceWorkerPath,
  hasStaleData = false,
  hideInDev = true,
  copy,
}: Omit<UpdateGuardProps, "children">) {
  const isDev =
    typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    Boolean(import.meta.env.DEV);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ serviceWorkerPath });

  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, () => true);

  const closePrompt = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const offlineMessage = useMemo(() => {
    if (isOnline) {
      return null;
    }

    return hasStaleData
      ? (copy?.offlineStaleMessage ?? "Offline - showing cached data where available")
      : (copy?.offlineMessage ?? "Offline - data may be unavailable");
  }, [copy?.offlineMessage, copy?.offlineStaleMessage, hasStaleData, isOnline]);

  if (hideInDev && isDev) {
    return null;
  }

  return (
    <>
      {offlineMessage ? (
        <div className="fixed inset-x-0 bottom-16 z-50 flex justify-center px-4">
          <div className="border-default bg-surface flex items-center gap-3 rounded-md border px-4 py-2">
            <span className="text-text-primary text-sm">{offlineMessage}</span>
          </div>
        </div>
      ) : null}

      {offlineReady || needRefresh ? (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="border-default bg-surface flex items-center gap-3 rounded-md border px-4 py-2">
            <span className="text-text-primary text-sm">
              {offlineReady
                ? (copy?.offlineReady ?? "App ready to work offline")
                : (copy?.newContentAvailable ?? "New content available")}
            </span>
            {needRefresh ? (
              <button
                type="button"
                onClick={() => updateServiceWorker(true)}
                className="text-accent text-sm font-semibold"
              >
                {copy?.refreshButton ?? "Refresh"}
              </button>
            ) : null}
            <button type="button" onClick={closePrompt} className="text-text-secondary text-sm">
              {copy?.closeButton ?? "Close"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function UpdateGuard({
  children,
  serviceWorkerPath,
  hasStaleData = false,
  hideInDev = true,
  copy,
}: UpdateGuardProps) {
  const isClient = typeof window !== "undefined";

  return (
    <>
      {children}
      {isClient ? (
        <UpdateGuardClient
          serviceWorkerPath={serviceWorkerPath}
          hasStaleData={hasStaleData}
          hideInDev={hideInDev}
          copy={copy}
        />
      ) : null}
    </>
  );
}
