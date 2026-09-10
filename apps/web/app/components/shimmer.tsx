'use client';

import type { MotionProps } from 'motion/react';
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties, ElementType, JSX } from 'react';
import { memo, useMemo } from 'react';

import { cn } from '~/lib/utils';

import styles from './shimmer.module.css';

type MotionHTMLProps = MotionProps & Record<string, unknown>;

const motionComponentCache = new Map<
  keyof JSX.IntrinsicElements,
  React.ComponentType<MotionHTMLProps>
>();

const getMotionComponent = (element: keyof JSX.IntrinsicElements) => {
  let component = motionComponentCache.get(element);
  if (!component) {
    component = motion.create(element);
    motionComponentCache.set(element, component);
  }
  return component;
};

export interface TextShimmerProps {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = 'p',
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const MotionComponent = getMotionComponent(Component as keyof JSX.IntrinsicElements);
  const reduceMotion = useReducedMotion() === true;

  const dynamicSpread = useMemo(() => (children?.length ?? 0) * spread, [children, spread]);

  if (reduceMotion) {
    return (
      <Component className={cn('inline-block text-muted-foreground', className)}>
        {children}
      </Component>
    );
  }

  return (
    <MotionComponent
      animate={{ backgroundPosition: '0% center' }}
      className={cn(
        styles.shimmerText,
        'relative inline-block bg-clip-text text-transparent',
        className,
      )}
      initial={{ backgroundPosition: '100% center' }}
      style={{ '--spread': `${dynamicSpread}px` } as CSSProperties}
      transition={{
        duration,
        ease: 'linear',
        repeat: Number.POSITIVE_INFINITY,
      }}
    >
      {children}
    </MotionComponent>
  );
};

export const Shimmer = memo(ShimmerComponent);
