import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLocation, useNavigation } from 'react-router';

/**
 * Choreographed route changes: a volt progress hairline while the next
 * route loads, then a fade/slide/blur entrance for the new page.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigation = useNavigation();
  const reduceMotion = useReducedMotion();
  const loading = navigation.state !== 'idle';

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[2px] overflow-hidden"
      >
        {loading ? <div className="route-bar h-full w-1/3" /> : null}
      </div>
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={location.pathname}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          className="flex min-h-0 flex-1 flex-col"
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, filter: 'blur(4px)' }}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, filter: 'blur(4px)' }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
