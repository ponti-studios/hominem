import { playEnterRow, playExitRow, reducedMotion } from '@hakumi/ui/lib/gsap';

export function animateNotesRowEnter(element: HTMLElement) {
  if (reducedMotion()) {
    return;
  }

  playEnterRow(element, 0);
}

export function animateNotesRowExit(element: HTMLElement, onComplete?: () => void) {
  if (reducedMotion()) {
    onComplete?.();
    return;
  }

  playExitRow(element, onComplete);
}
