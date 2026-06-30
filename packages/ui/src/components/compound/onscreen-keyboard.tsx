"use client";

import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

export type LetterState = "absent" | "correct" | "present";

export interface OnscreenKeyboardProps {
  /** Maps each uppercase letter to its current state. */
  letterStates?: Record<string, LetterState>;
  /** Called when a letter key is pressed. Receives the uppercase letter. */
  onLetter?: (letter: string) => void;
  /** Called when the Enter key is pressed. */
  onEnter?: () => void;
  /** Called when the Backspace key is pressed. */
  onBackspace?: () => void;
  /** Disables all keys (dimmed, no interaction). */
  disabled?: boolean;
  /** Display only — keys render at full opacity with no hover/click effects. */
  readOnly?: boolean;
  className?: string;
}

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] as const;

const keyboardKeyVariants = cva(
  "flex items-center justify-center rounded border font-medium transition-colors",
  {
    variants: {
      kind: {
        letter: "min-h-11 min-w-0 flex-1 px-0 text-base sm:text-sm",
        action: "min-h-11 shrink-0 px-3 text-sm sm:px-4 sm:text-xs",
      },
      state: {
        inactive: "border-border bg-background text-foreground hover:bg-muted",
        absent: "border-border bg-muted text-muted-foreground",
        present: "border-amber-300 bg-amber-100 text-amber-950",
        correct: "border-emerald-300 bg-emerald-100 text-emerald-950",
        action: "border-border bg-muted text-foreground hover:bg-secondary",
      },
    },
    defaultVariants: {
      kind: "letter",
      state: "inactive",
    },
  },
);

export function OnscreenKeyboard({
  letterStates = {},
  onLetter,
  onEnter,
  onBackspace,
  disabled = false,
  readOnly = false,
  className,
}: OnscreenKeyboardProps) {
  const keyClass = (kind: "letter" | "action", state: LetterState | "action") =>
    cn(
      keyboardKeyVariants({ kind, state }),
      readOnly && "pointer-events-none cursor-default",
      disabled && "cursor-not-allowed opacity-50",
    );

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {ROWS.map((row, i) => (
        <div key={row} className="flex w-full items-center justify-center gap-0.5 sm:gap-1">
          {i === 2 && (
            <button
              className={keyClass("action", "action")}
              disabled={disabled}
              tabIndex={readOnly ? -1 : undefined}
              onClick={onEnter ? () => onEnter() : undefined}
              type="button"
            >
              Enter
            </button>
          )}
          {row.split("").map((letter) => (
            <button
              key={letter}
              className={keyClass("letter", letterStates[letter] ?? "inactive")}
              disabled={disabled}
              tabIndex={readOnly ? -1 : undefined}
              onClick={onLetter ? () => onLetter(letter) : undefined}
              type="button"
            >
              {letter}
            </button>
          ))}
          {i === 2 && (
            <button
              className={keyClass("action", "action")}
              disabled={disabled}
              tabIndex={readOnly ? -1 : undefined}
              onClick={onBackspace ? () => onBackspace() : undefined}
              type="button"
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
