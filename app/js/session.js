// Who is signed in and which servers we're talking to. Persisted so a restart
// goes straight to the home screen.
//
// Every server in the account is used at once, like the official app. Items
// remember which server they came from (item._srv, set in plex/server.js), and
// serverOf(item) finds it again. session.server is the first one, for anything
// that isn't tied to an item.
import * as store from './util/store.js';
import { Server } from './plex/server.js';
import { getServers, connect } from './plex/auth.js';
import { log, warn } from './util/log.js';

export const session = {
  token: store.get('token'),
  user: store.get('user'),
  server: null,
  servers: [],
};

let byId = {};

function apply(list) {
  session.servers = list.map(s => new Server(s));
  session.server = session.servers[0] || null;
  byId = {};
  session.servers.forEach(s => { byId[s.id] = s; });
}

// Older builds saved a single server; start with it, then find the rest.
const legacy = store.get('server');
apply(store.get('servers') || (legacy ? [legacy] : []));
export const needsDiscovery = !store.get('servers') && !!legacy && legacy.id !== 'lan-dev';

export function serverOf(thing) {
  return (thing && thing._srv && byId[thing._srv]) || session.server;
}

export function signIn(token, user) {
  session.token = token;
  session.user = { title: user.title || user.username, thumb: user.thumb, uuid: user.uuid };
  store.set('token', token);
  store.set('user', session.user);
}

function setServers(entries) {
  apply(entries);
  store.set('servers', entries);
  store.set('server', undefined);
}

// Servers the user switched off in Settings.
export function disabledServers() {
  return store.get('disabledServers', []);
}

export function setDisabledServers(ids) {
  store.set('disabledServers', ids);
}

// Connect to every enabled server in parallel; keep the ones that answer.
// The previous primary stays first so Home doesn't reshuffle.
export async function connectAll(resources) {
  const off = disabledServers();
  let wanted = resources.filter(r => off.indexOf(r.clientIdentifier) === -1);
  if (!wanted.length) wanted = resources.slice(0, 1);
  const primary = session.server && session.server.id;
  wanted.sort((a, b) => (b.clientIdentifier === primary) - (a.clientIdentifier === primary) || (b.owned ? 1 : 0) - (a.owned ? 1 : 0));
  const results = await Promise.all(wanted.map(r => connect(r).then(uri => ({ r, uri }), e => {
    warn('server unreachable', r.name, e.message);
    return null;
  })));
  const entries = results.filter(Boolean).map(({ r, uri }) => ({ uri, token: r.accessToken, name: r.name, id: r.clientIdentifier }));
  if (!entries.length) throw new Error('Could not reach any of your Plex servers');
  setServers(entries);
  log('connected to', entries.map(e => e.name).join(', '));
  return session.servers;
}

export function signOut() {
  session.token = null;
  session.user = null;
  apply([]);
  store.set('token', undefined);
  store.set('user', undefined);
  store.set('server', undefined);
  store.set('servers', undefined);
  store.set('homeCache', undefined);
}

// Saved URIs can go stale (DHCP, remote vs. home). Re-resolve them from plex.tv.
export async function reconnect() {
  const resources = await getServers(session.token);
  if (!resources.length) throw new Error('No Plex servers on this account');
  return connectAll(resources);
}
