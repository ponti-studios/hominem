const variants = [
  {
    name: 'Atelier',
    theme: 'atelier',
    headline: 'More room to\nthink',
    copy: '',
    label: 'Email address',
    cta: 'Continue',
    helper: 'By continuing, you agree to our Terms and Privacy Policy.',
  },
  {
    name: 'Nocturne',
    theme: 'nocturne',
    headline: 'Welcome\nback.',
    copy: 'A clear mind starts with a place for everything.',
    label: 'YOUR EMAIL',
    cta: 'Continue with email',
    helper: 'Private by design.',
  },
  {
    name: 'Gallery',
    theme: 'gallery',
    headline: 'Make space\nfor what matters.',
    copy: 'Chat, notes, and tasks in one considered place.',
    label: 'Email address',
    cta: 'Send a sign-in code',
    helper: 'A quiet place for your day.',
  },
];

const stage = document.getElementById('stage');
const picker = document.querySelector('.proto-picker');
const highlight = picker.querySelector('.proto-picker-highlight');
const items = [...picker.querySelectorAll('.proto-picker-item:not(.proto-picker-replay)')];
const replay = picker.querySelector('.proto-picker-replay');
let current = 0;
let currentScreen = 'email';

function screen(v, mode = 'email') {
  if (mode === 'splash') {
    const caption =
      v.theme === 'atelier'
        ? 'A quieter space for your day'
        : v.theme === 'nocturne'
          ? 'Your day, in its place'
          : 'Chat · Notes · Tasks';
    return `<article class="device ${v.theme} launch" aria-label="${v.name} launch screen concept">
      <div class="status"><span>9:41</span><span class="status-icons"><i class="signal"></i><i class="wifi"></i><i class="battery"></i></span></div>
      <div class="safe"><div class="wordmark">omiro</div><div class="launch-content"><div class="launch-logo">omiro</div><div class="launch-orbit" aria-hidden="true"></div><p class="launch-tagline">${v.headline.replace('\n', ' ')}</p><div class="launch-caption">${caption}</div></div></div>
      <div class="bottomline" aria-hidden="true"></div>
    </article>`;
  }
  const verify = mode === 'code';
  const headline = verify ? 'Check your email.' : v.headline.replace('\n', '<br>');
  const copy = verify ? 'Enter the six-digit code we sent you.' : v.copy;
  return `<article class="device ${v.theme}" aria-label="${v.name} sign-in concept">
    <div class="status"><span>9:41</span><span class="status-icons"><i class="signal"></i><i class="wifi"></i><i class="battery"></i></span></div>
    <div class="safe"><div class="wordmark">omiro</div><div class="concept-mark" aria-hidden="true"></div>
      <section class="auth ${verify ? 'verify-state' : 'email-state'}">
        ${verify ? '<button class="back" data-back>← &nbsp; Change email</button>' : ''}
        <div class="kicker">${verify ? 'SECURE SIGN IN' : v.theme === 'atelier' ? '' : v.theme === 'gallery' ? 'A MORE CONSIDERED DAY' : 'A PERSONAL WORKSPACE'}</div>
        <h2 class="title">${headline}</h2>${copy ? `<p class="description">${copy}</p>` : ''}
        ${verify ? `<label class="field-label" for="code">VERIFICATION CODE</label><input class="code" id="code" aria-label="Verification code" inputmode="numeric" maxlength="6" placeholder="— — — — — —" /><div class="form-message" aria-live="polite"></div><button class="primary" data-finish>Continue</button><p class="foot">Didn't receive it? <a href="#" data-resend>Send again</a></p>` : `<label class="field-label" for="email">${v.label}</label><input class="email" id="email" type="email" autocomplete="email" placeholder="name@example.com" /><div class="form-message" aria-live="polite"></div><button class="primary" data-continue>${v.cta}</button><p class="foot">${v.helper}</p>`}
      </section>
    </div><div class="bottomline" aria-hidden="true"></div>
  </article>`;
}

function wireCode(i) {
  const code = stage.querySelector('#code');
  stage.querySelector('[data-back]').addEventListener('click', () => {
    currentScreen = 'email';
    mount(i);
  });
  stage.querySelector('[data-finish]').addEventListener('click', () => {
    const feedback = stage.querySelector('.form-message');
    feedback.textContent =
      code.value.length === 6
        ? 'You’re signed in. Welcome to Omiro.'
        : 'Enter the six-digit code to continue.';
    feedback.classList.add('visible');
  });
  stage.querySelector('[data-resend]').addEventListener('click', (event) => {
    event.preventDefault();
    const feedback = stage.querySelector('.form-message');
    feedback.textContent = 'A fresh code is on its way.';
    feedback.classList.add('visible');
  });
}

function mount(i) {
  stage.innerHTML = '';
  requestAnimationFrame(() => {
    const v = variants[i];
    stage.innerHTML = `<div class="screen-switch" role="group" aria-label="Screen preview">
      <span class="screen-switch-label">PREVIEW</span>
      <button type="button" data-mode="splash" aria-pressed="${currentScreen === 'splash'}">Launch</button>
      <button type="button" data-mode="email" aria-pressed="${currentScreen === 'email'}">Email</button>
      <button type="button" data-mode="code" aria-pressed="${currentScreen === 'code'}">Code</button>
    </div>${screen(v, currentScreen)}`;
    stage.querySelectorAll('[data-mode]').forEach((button) =>
      button.addEventListener('click', () => {
        currentScreen = button.dataset.mode;
        mount(i);
      }),
    );
    if (currentScreen === 'code') {
      wireCode(i);
      return;
    }
    if (currentScreen === 'splash') return;
    const email = stage.querySelector('#email');
    const message = stage.querySelector('.form-message');
    stage.querySelector('[data-continue]')?.addEventListener('click', () => {
      if (!email.value.includes('@') || !email.value.includes('.')) {
        message.textContent = 'Enter a valid email address.';
        message.classList.add('visible');
        email.focus();
        return;
      }
      currentScreen = 'code';
      mount(i);
    });
    email?.addEventListener('input', () => message.classList.remove('visible'));
  });
}

function moveHighlight() {
  const el = items[current];
  highlight.style.width = `${el.offsetWidth}px`;
  highlight.style.transform = `translateX(${el.offsetLeft}px)`;
}

function setActive(i) {
  if (i < 0 || i >= variants.length) return;
  current = i;
  items.forEach((el, j) => {
    el.toggleAttribute('data-active', j === i);
    if (j === i) el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  });
  moveHighlight();
  const url = new URL(location);
  url.searchParams.set('v', i + 1);
  history.replaceState(null, '', url);
  mount(i);
}

items.forEach((el, i) => el.addEventListener('click', () => setActive(i)));
replay.addEventListener('click', () => mount(current));
window.addEventListener('resize', moveHighlight);
document.addEventListener('keydown', (e) => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const num = Number.parseInt(e.key, 10);
  if (num >= 1 && num <= variants.length) setActive(num - 1);
  else if (e.key === 'ArrowRight') setActive((current + 1) % variants.length);
  else if (e.key === 'ArrowLeft') setActive((current - 1 + variants.length) % variants.length);
  else if (e.key === 'r' || e.key === 'R') mount(current);
});

setActive((Number.parseInt(new URLSearchParams(location.search).get('v'), 10) || 1) - 1);
requestAnimationFrame(() => requestAnimationFrame(() => picker.setAttribute('data-ready', '')));
