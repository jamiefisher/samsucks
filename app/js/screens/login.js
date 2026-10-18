// Sign in with a plex.tv/link code (or by scanning the QR code with a phone),
// then connect to every server on the account.
import qrcode from '../vendor/qrcode.js';
import { h, setText } from '../util/dom.js';
import { createPin, checkPin, authAppUrl, getUser, getServers } from '../plex/auth.js';
import { signIn, connectAll, session } from '../session.js';
import { error, log } from '../util/log.js';
import { useAmbience } from '../ui/backdrop.js';

export function LoginScreen({ onDone }) {
  const el = h('div', 'screen login');
  const ambience = useAmbience({ topLeft: '3a1518', topRight: '161922', bottomLeft: '1b1f2b', bottomRight: '2a1012' });
  const left = h('div', 'login-art', el);
  const art = h('img', '', left);
  art.src = 'img/mascot-512.png';
  const panel = h('div', 'login-panel', el);
  h('h1', 'login-title', panel).textContent = 'Sign in to Plex';
  const steps = h('ol', 'login-steps', panel);
  h('li', '', steps).innerHTML = 'On your phone or computer, go to <b>plex.tv/link</b>';
  h('li', '', steps).textContent = 'Enter this code:';
  const code = h('div', 'login-code', panel);
  const qrWrap = h('div', 'login-qr', panel);
  const qrBox = h('div', 'login-qr-box', qrWrap);
  h('div', 'login-qr-label', qrWrap).textContent = 'or scan to sign in';
  const status = h('div', 'login-status', panel);

  let timer = 0;
  let alive = true;
  let retry = null;  // signed in, but no server answered: OK tries again

  async function start() {
    clearTimeout(timer);
    try {
      setText(status, '');
      const pin = await createPin();
      if (!alive) return;
      setText(code, pin.code);
      const qr = qrcode(0, 'M');
      qr.addData(authAppUrl(pin.code));
      qr.make();
      qrBox.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
      const expires = Date.now() + (pin.expiresIn || 900) * 1000 - 5000;
      const poll = async () => {
        if (!alive) return;
        if (Date.now() > expires) { start(); return; }
        try {
          const token = await checkPin(pin.id);
          if (token) { await finish(token); return; }
        } catch (e) {
          error('pin poll failed', e);
        }
        timer = setTimeout(poll, 2000);
      };
      timer = setTimeout(poll, 2000);
    } catch (e) {
      error('createPin failed', e);
      setText(status, 'Can\'t reach plex.tv. Retrying…');
      timer = setTimeout(start, 4000);
    }
  }

  async function finish(token) {
    setText(status, 'Signed in. Finding your servers…');
    const user = await getUser(token);
    signIn(token, user);
    log('signed in as', session.user.title);
    const servers = await getServers(token);
    if (!servers.length) {
      setText(status, 'No Plex Media Servers on this account.');
      return;
    }
    setText(status, 'Connecting to ' + (servers.length > 1 ? servers.length + ' servers' : servers[0].name) + '…');
    try {
      await connectAll(servers);
    } catch (e) {
      setText(status, e.message + '. Press OK to try again.');
      retry = () => finish(token).catch(err => setText(status, err.message));
      return;
    }
    onDone();
  }

  start();

  return {
    el,
    name: 'login',
    onShow() { ambience.restore(); },
    onKey(action) {
      if (action === 'enter') {
        const r = retry;
        retry = null;
        if (r) r(); else start();
        return true;
      }
      return false;
    },
    destroy() {
      alive = false;
      clearTimeout(timer);
    },
  };
}
