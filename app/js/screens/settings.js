// Account, server and diagnostics.
import { DEV, VERSION } from '../config.js';
import { h, setText, toggleClass } from '../util/dom.js';
import { session, signOut, connectAll, disabledServers, setDisabledServers } from '../session.js';
import { getServers } from '../plex/auth.js';
import { setHud, hudEnabled } from '../ui/hud.js';
import * as router from '../router.js';
import { error } from '../util/log.js';
import { useAmbience, setLegacyGradients, legacyGradients } from '../ui/backdrop.js';

export function SettingsScreen() {
  const el = h('div', 'screen settings');
  const ambience = useAmbience();
  h('h1', 'settings-title', el).textContent = 'Settings';
  const list = h('div', 'settings-list', el);
  const foot = h('div', 'settings-foot', el);
  foot.textContent = 'SamSUCKS ' + VERSION + (DEV ? ' (dev)' : '') + ' · ' + session.servers.map(s => s.name + ' ' + s.uri).join('  ·  ');

  let index = 0;
  let items = [];

  function build() {
    list.innerHTML = '';
    items = [
      { label: 'Servers', value: session.servers.length > 2 ? session.servers.length + ' connected' : session.servers.map(s => s.name).join(', ') || '—', run: openServers },
      { label: 'Signed in as', value: session.user ? session.user.title : '—', run: doSignOut, action: 'Sign out' },
      { label: 'Performance overlay', value: hudEnabled() ? 'On' : 'Off', run: () => { setHud(!hudEnabled()); build(); } },
      // For before/after recordings: brings back the full-screen gradients that took ~2s per repaint.
      { label: 'Demo: original slow renderer', value: legacyGradients() ? 'On' : 'Off', run: () => { setLegacyGradients(!legacyGradients()); build(); } },
    ];
    items.forEach(it => {
      it.el = h('div', 'setting', list);
      h('span', 'setting-label', it.el).textContent = it.label;
      h('span', 'setting-value', it.el).textContent = it.value + (it.action ? '  ·  ' + it.action : '');
    });
    render();
  }

  function render() {
    items.forEach((it, i) => toggleClass(it.el, 'focus', i === index));
  }

  function openServers() {
    router.push(ServersScreen({ onDone: restart }));
  }

  function doSignOut() {
    signOut();
    restart();
  }

  function restart() {
    // Rebuild from scratch: app.js decides between login and home.
    window.dispatchEvent(new Event('samsucks:restart'));
  }

  build();

  return {
    el,
    name: 'settings',
    onShow() { ambience.restore(); },
    onKey(action) {
      if (action === 'up') { index = Math.max(0, index - 1); render(); return true; }
      if (action === 'down') { index = Math.min(items.length - 1, index + 1); render(); return true; }
      if (action === 'enter') { items[index].run(); return true; }
      return false;
    },
  };
}

// Every server on the account, each switched on or off. OK toggles; Back applies.
function ServersScreen({ onDone }) {
  const el = h('div', 'screen picker');
  const ambience = useAmbience();
  h('h1', 'picker-title', el).textContent = 'Servers';
  const list = h('div', 'picker-list', el);
  const status = h('div', 'login-status', el);
  setText(status, 'Finding your servers…');

  const startOff = disabledServers();
  let off = startOff.slice();
  let servers = [];
  let index = 0;
  let busy = false;

  function render() {
    list.innerHTML = '';
    servers.forEach((s, i) => {
      const b = h('div', 'setting', list);
      h('span', 'setting-label', b).textContent = s.name + (s.owned ? '' : '  ·  shared by ' + (s.sourceTitle || 'a friend'));
      h('span', 'setting-value', b).textContent = off.indexOf(s.clientIdentifier) === -1 ? 'On' : 'Off';
      toggleClass(b, 'focus', i === index);
    });
  }

  getServers(session.token).then(list => {
    servers = list;
    setText(status, list.length ? 'OK turns a server on or off. Back saves.' : 'No Plex Media Servers on this account.');
    render();
  }, e => {
    error('server list failed', e);
    setText(status, 'Couldn\'t reach plex.tv.');
  });

  async function apply() {
    const changed = off.length !== startOff.length || off.some(id => startOff.indexOf(id) === -1);
    if (!changed || !servers.length) return false;
    busy = true;
    setText(status, 'Connecting…');
    setDisabledServers(off);
    try {
      await connectAll(servers);
      onDone();
    } catch (e) {
      busy = false;
      setText(status, e.message);
    }
    return true;
  }

  return {
    el,
    name: 'servers',
    onShow() { ambience.restore(); },
    onKey(action) {
      if (busy) return true;
      if (action === 'up' || action === 'down') {
        index = Math.max(0, Math.min(servers.length - 1, index + (action === 'down' ? 1 : -1)));
        render();
        return true;
      }
      if (action === 'enter' && servers[index]) {
        const id = servers[index].clientIdentifier;
        const i = off.indexOf(id);
        if (i === -1) {
          // Keep at least one server on.
          if (servers.filter(s => off.indexOf(s.clientIdentifier) === -1).length > 1) off.push(id);
        } else {
          off.splice(i, 1);
        }
        render();
        return true;
      }
      if (action === 'back') {
        apply().then(handled => { if (!handled) router.back(); });
        return true;
      }
      return false;
    },
  };
}
