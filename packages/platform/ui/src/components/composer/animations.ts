import gsap from 'gsap';

export const PILL_HEIGHT = 56;
export const MOBILE_EXPANDED_HEIGHT_VH = 0.7;
export const COMPOSER_RESTING_HEIGHT = 112;
export function playSwipeSnap(el: HTMLDivElement, targetHeight: number, onComplete?: () => void) {
  const vars: gsap.TweenVars = {
    height: targetHeight,
    duration: 0.3,
    ease: 'elastic.out(1, 0.5)',
  };
  if (onComplete) vars.onComplete = onComplete;
  gsap.to(el, vars);
}
