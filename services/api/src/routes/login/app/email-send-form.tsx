// @jsxImportSource react
import { useRef, useState, type FormEvent } from 'react';

import styles from './email-send-form.module.css';

type EmailSendFormProps = {
  email: string;
  error?: string;
  resumeQuery: string;
  onEmailChange: (email: string) => void;
};

const RING_LENGTH = 2 * Math.PI * 22;
const SEND_ANIMATION_MS = 520;

// Structural checks give a specific, actionable hint while the user is still
// typing. The final "looks done" gate defers to the browser's own type="email"
// validator instead of hand-rolling a regex.
function emailProgress(email: string, valid: boolean): [number, string] {
  if (!email) return [0, 'Type your email'];
  if (/\s/.test(email)) return [0.2, 'No spaces, please'];
  if (!email.includes('@')) return [0.25, 'Add the @'];
  const domain = email.split('@')[1] ?? '';
  if (!domain) return [0.45, 'Now the domain'];
  if (!domain.includes('.')) return [0.65, 'Add the extension, like .com'];
  const extension = domain.split('.').pop() ?? '';
  if (extension.length < 2) return [0.85, 'Finish the extension'];
  return valid ? [1, 'Looks good. Press enter to send'] : [0.85, 'Check the address'];
}

// The input's own text is transparent; this mirror paints the same string with
// the domain in the accent color. It stays aligned because both layers share
// font, padding and scroll offset.
function Mirror({ email }: { email: string }) {
  const at = email.indexOf('@');
  if (at < 0) return <>{email}</>;
  return (
    <>
      {email.slice(0, at)}
      <span className={styles.domain}>{email.slice(at)}</span>
    </>
  );
}

export function EmailSendForm({ email, error, resumeQuery, onEmailChange }: EmailSendFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const mirrorRef = useRef<HTMLSpanElement | null>(null);
  const [valid, setValid] = useState(false);
  const [sending, setSending] = useState(false);

  const [progress, hint] = emailProgress(email, valid);

  const syncScroll = (input: HTMLInputElement) => {
    if (mirrorRef.current) mirrorRef.current.style.transform = `translateX(${-input.scrollLeft}px)`;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (sending) {
      event.preventDefault();
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    // Let the send animation play, then submit natively (already validated).
    event.preventDefault();
    setSending(true);
    window.setTimeout(() => formRef.current?.submit(), SEND_ANIMATION_MS);
  };

  return (
    <form
      action="/login/send"
      className="flex flex-col gap-3"
      data-error={error ? true : undefined}
      method="post"
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <input name="resume" type="hidden" value={resumeQuery} />
      <label className="text-[13px] font-medium text-auth-text" htmlFor="email">
        Email address
      </label>
      <div
        className={styles.pill}
        data-ready={valid ? true : undefined}
        data-sending={sending ? true : undefined}
      >
        <div aria-hidden="true" className={styles.mirror}>
          <span className={styles.mirrorText} ref={mirrorRef}>
            <Mirror email={email} />
          </span>
        </div>
        <input
          autoComplete="email"
          autoFocus
          className={styles.input}
          id="email"
          name="email"
          onChange={(event) => {
            onEmailChange(event.target.value);
            setValid(event.target.validity.valid && event.target.value.length > 0);
            syncScroll(event.target);
          }}
          onScroll={(event) => syncScroll(event.currentTarget)}
          placeholder="you@example.com"
          required
          spellCheck={false}
          type="email"
          value={email}
        />
        <button aria-label="Send me a code" className={styles.go} type="submit">
          <svg aria-hidden="true" className={styles.ring} viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" />
            <circle
              className={styles.ringFill}
              cx="26"
              cy="26"
              r="22"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - progress)}
            />
          </svg>
          <svg aria-hidden="true" className={styles.arrow} viewBox="0 0 24 24">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <p aria-live="polite" className={styles.hint}>
        {hint}
      </p>
    </form>
  );
}
