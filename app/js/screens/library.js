// A whole library as a virtualized poster grid, loaded page by page.
// Above the grid is a filter bar (press ▲ from the top row): sort, unwatched,
// genre, decade and content rating. OK on a chip opens its list. Choices are
// remembered per library.
// Yellow still cycles the sort; CH▲/CH▼ jump by letter (title sort) or by page.
import { h, setText, setTransform, toggleClass } from '../util/dom.js';
import { Grid } from '../ui/grid.js';
import { useAmbience, HeroArt } from '../ui/backdrop.js';
import { serverOf } from '../session.js';
import { prefetch } from '../ui/images.js';
import { isFast } from '../input.js';
import { openItem, playItem } from '../nav.js';
import { error } from '../util/log.js';
import { metaLine } from '../util/format.js';
import * as store from '../util/store.js';

const PAGE = 140;
const MENU_ROWS = 9;
const MENU_ROW_H = 60;
const SORTS = [
  { id: 'titleSort', label: 'A–Z' },
  { id: 'addedAt:desc', label: 'Recently added' },
  { id: 'originallyAvailableAt:desc', label: 'Release date' },
  { id: 'audienceRating:desc', label: 'Rating' },
];
// Filters whose values come from the server. Chosen value is { title, params }.
const LISTS = [
  { id: 'genre', label: 'Genre' },
  { id: 'decade', label: 'Decade' },
  { id: 'contentRating', label: 'Rating' },
];

export function LibraryScreen(section) {
  const server = serverOf(section);
  const el = h('div', 'screen library');
  const ambience = useAmbience();
  const art = new HeroArt(el, 'hero-art lib-art');
  let artTimer = 0;
  const head = h('header', 'lib-head', el);
  h('h1', 'lib-title', head).textContent = section.title;
  const count = h('div', 'lib-count', head);
  const focusInfo = h('div', 'lib-focus', head);
  const bar = h('div', 'lib-bar', el);
  const menu = h('div', 'lib-menu hidden', el);
  const menuTrack = h('div', 'lib-menu-track', menu);
  const empty = h('div', 'lib-empty', el);

  const type = section.type === 'show' ? 2 : 1;
  const noun = section.type === 'show' ? 'shows' : 'movies';
  const storeKey = 'libFilters.' + (section._srv || '') + '.' + section.key;

  // --- state ------------------------------------------------------------
  const saved = store.get(storeKey, {});
  let sortIndex = Math.max(0, SORTS.findIndex(s => s.id === saved.sort));
  let unwatched = !!saved.unwatched;
  const chosen = {};          // list id -> { title, params } | undefined
  LISTS.forEach(l => { if (saved[l.id]) chosen[l.id] = saved[l.id]; });
  const values = {};          // list id -> [{ title, params }] once loaded

  let zone = 'grid';          // 'grid' | 'bar' | 'menu'
  let chipIndex = 0;
  let menuOptions = [];
  let menuIndex = 0;
  let menuFor = null;

  let pages = new Map();      // page -> 'loading' | true
  let items = [];
  let letters = [];           // [{ title: 'A', start: 0 }]
  let generation = 0;

  function persist() {
    const o = { sort: SORTS[sortIndex].id, unwatched };
    LISTS.forEach(l => { if (chosen[l.id]) o[l.id] = chosen[l.id]; });
    store.set(storeKey, o);
  }

  function filterParams() {
    const p = {};
    if (unwatched) p[type === 2 ? 'unwatchedLeaves' : 'unwatched'] = 1;
    LISTS.forEach(l => { if (chosen[l.id]) Object.assign(p, chosen[l.id].params); });
    return p;
  }

  function filtered() {
    return unwatched || LISTS.some(l => chosen[l.id]);
  }

  // --- filter bar -------------------------------------------------------
  const chips = [
    { id: 'sort', text: () => 'Sort: ' + SORTS[sortIndex].label, on: () => sortIndex !== 0 },
    { id: 'unwatched', text: () => unwatched ? 'Unwatched' : 'All ' + noun, on: () => unwatched },
  ].concat(LISTS.map(l => ({
    id: l.id, list: l,
    text: () => chosen[l.id] ? chosen[l.id].title : l.label,
    on: () => !!chosen[l.id],
  })));
  chips.push({ id: 'clear', text: () => 'Clear', on: () => false, hidden: () => !filtered() });
  chips.forEach(c => {
    c.el = h('div', 'chip', bar);
    c.label = h('span', '', c.el);
  });

  function visibleChips() {
    return chips.filter(c => !(c.hidden && c.hidden()));
  }

  function renderBar() {
    const vis = visibleChips();
    chipIndex = Math.min(chipIndex, vis.length - 1);
    chips.forEach(c => {
      setText(c.label, c.text());
      const hidden = !!(c.hidden && c.hidden());
      toggleClass(c.el, 'hidden', hidden);
      toggleClass(c.el, 'on', c.on());
      toggleClass(c.el, 'focus', zone !== 'grid' && vis[chipIndex] === c);
      toggleClass(c.el, 'open', zone === 'menu' && vis[chipIndex] === c);
    });
    toggleClass(grid.ring, 'on', zone === 'grid');
    toggleClass(el, 'in-bar', zone !== 'grid');
  }

  async function openMenu(chip) {
    let options;
    if (chip.id === 'sort') {
      options = SORTS.map((s, i) => ({ title: s.label, pick: () => { sortIndex = i; } }));
      menuIndex = sortIndex;
    } else {
      const l = chip.list;
      if (!values[l.id]) {
        menuFor = chip;
        try {
          values[l.id] = await server.filterValues(section.key, l.id, type);
        } catch (e) {
          error('filter values failed', l.id, e);
          values[l.id] = [];
        }
        if (menuFor !== chip || zone !== 'bar') return; // moved on while loading
      }
      options = [{ title: 'Any ' + l.label.toLowerCase(), pick: () => { chosen[l.id] = undefined; } }]
        .concat(values[l.id].map(v => ({ title: v.title, value: v, pick: () => { chosen[l.id] = v; } })));
      const cur = chosen[l.id];
      menuIndex = cur ? Math.max(0, options.findIndex(o => o.value && o.value.title === cur.title)) : 0;
    }
    menuFor = chip;
    menuOptions = options;
    menuTrack.innerHTML = '';
    options.forEach(o => { o.el = h('div', 'lib-opt', menuTrack); o.el.textContent = o.title; });
    if (options.length < 2) h('div', 'lib-opt lib-opt-none', menuTrack).textContent = 'Nothing to filter by';
    menu.style.left = (bar.offsetLeft + chip.el.offsetLeft) + 'px';
    menu.style.height = (Math.min(MENU_ROWS, Math.max(options.length, 2)) * MENU_ROW_H + 16) + 'px';
    menu.classList.remove('hidden');
    zone = 'menu';
    renderMenu();
    renderBar();
  }

  function renderMenu() {
    menuOptions.forEach((o, i) => toggleClass(o.el, 'focus', i === menuIndex));
    const first = Math.max(0, Math.min(menuOptions.length - MENU_ROWS, menuIndex - Math.floor(MENU_ROWS / 2)));
    setTransform(menuTrack, 'translateY(' + (-first * MENU_ROW_H) + 'px)');
  }

  function closeMenu() {
    menu.classList.add('hidden');
    zone = 'bar';
    renderBar();
  }

  function applyFilters() {
    persist();
    renderBar();
    reload();
  }

  function activateChip(chip) {
    if (chip.id === 'unwatched') { unwatched = !unwatched; applyFilters(); return; }
    if (chip.id === 'clear') {
      unwatched = false;
      LISTS.forEach(l => { chosen[l.id] = undefined; });
      applyFilters();
      return;
    }
    openMenu(chip);
  }

  // --- grid -------------------------------------------------------------
  let ready = false; // the Grid asks for rows while it's still being constructed
  const grid = new Grid({
    top: 210, height: 870, total: 0,
    getItem: i => items[i],
    onFocus: (item, index) => {
      // Warm posters for the row just past the recycled pool.
      if (!isFast()) {
        const start = (Math.floor(index / grid.cols) + grid.poolRows - 1) * grid.cols;
        for (let i = start; i < start + grid.cols; i++) {
          if (items[i]) prefetch(server.image(items[i].thumb, 216, 324));
        }
      }
      if (!item) { setText(focusInfo, ''); return; }
      setText(focusInfo, item.title + '   ' + metaLine(item));
      ambience.set(item.UltraBlurColors);
      // Backdrop follows focus, but not while a direction is held.
      clearTimeout(artTimer);
      artTimer = setTimeout(() => art.set(server.image(item.art, 1920, 1080)), isFast() ? 400 : 150);
    },
    onSelect: item => openItem(item),
    onNeed: (start, end) => {
      if (!ready) return;
      for (let p = Math.floor(start / PAGE); p <= Math.floor(end / PAGE); p++) loadPage(p);
    },
  });
  ready = true;
  el.appendChild(grid.el);

  async function loadPage(p) {
    if (pages.has(p)) return;
    if (grid.total && p * PAGE >= grid.total) return;
    if (p > 0 && !grid.total) return; // wait for page 0 to say how many there are
    pages.set(p, 'loading');
    const gen = generation;
    try {
      const res = await server.items(section.key, p * PAGE, PAGE, { sort: SORTS[sortIndex].id, type, filters: filterParams() });
      if (gen !== generation) return;
      res.items.forEach((it, i) => { items[p * PAGE + i] = it; });
      pages.set(p, true);
      if (grid.total !== res.total) grid.setTotal(res.total);
      else grid.refresh();
      if (p === 0) {
        setText(count, res.total + ' ' + noun + (filtered() ? ' (filtered)' : ''));
        setText(empty, res.total ? '' : filtered() ? 'Nothing matches these filters.' : 'This library is empty.');
        if (res.items[0]) grid.onFocus(grid.current(), grid.index);
        else setText(focusInfo, '');
      }
    } catch (e) {
      pages.delete(p);
      error('library page failed', section.title, p, e);
    }
  }

  async function loadLetters() {
    letters = [];
    if (SORTS[sortIndex].id !== 'titleSort') return;
    const gen = generation;
    try {
      const mc = await server.get('/library/sections/' + section.key + '/firstCharacter', Object.assign({ type }, filterParams()));
      if (gen !== generation) return;
      let start = 0;
      letters = (mc.Directory || []).map(d => {
        const l = { title: d.title, start };
        start += d.size;
        return l;
      });
    } catch (e) { /* letter jump just won't work */ }
  }

  function reload() {
    generation++;
    pages = new Map();
    items = [];
    grid.total = 0;
    grid.index = 0;
    grid.refresh();
    setText(empty, '');
    loadPage(0);
    loadLetters();
  }
  renderBar();
  reload();

  function jump(dir) {
    if (letters.length) {
      const i = grid.index;
      let li = letters.findIndex((l, k) => i >= l.start && (k === letters.length - 1 || i < letters[k + 1].start));
      li = Math.max(0, Math.min(letters.length - 1, li + dir));
      grid.focusIndex(letters[li].start);
      setText(focusInfo, letters[li].title);
    } else {
      grid.focusIndex(grid.index + dir * grid.cols * 3);
    }
  }

  function focusGrid() {
    if (!grid.total) return;
    zone = 'grid';
    renderBar();
    grid.onFocus(grid.current(), grid.index);
  }

  function menuKey(action) {
    switch (action) {
      case 'up': if (menuIndex > 0) { menuIndex--; renderMenu(); } return true;
      case 'down': if (menuIndex < menuOptions.length - 1) { menuIndex++; renderMenu(); } return true;
      case 'enter': {
        const o = menuOptions[menuIndex];
        closeMenu();
        if (o) { o.pick(); applyFilters(); }
        return true;
      }
      case 'back': case 'left': case 'right': closeMenu(); return true;
    }
    return true;
  }

  function barKey(action) {
    const vis = visibleChips();
    switch (action) {
      case 'left': if (chipIndex > 0) { chipIndex--; renderBar(); } return true;
      case 'right': if (chipIndex < vis.length - 1) { chipIndex++; renderBar(); } return true;
      case 'down': focusGrid(); return true;
      case 'enter': activateChip(vis[chipIndex]); return true;
      case 'up': return true;
      case 'back': if (grid.total) { focusGrid(); return true; } return false;
    }
    return false;
  }

  return {
    el,
    name: 'library',
    onShow() { ambience.restore(); },
    destroy() { clearTimeout(artTimer); },
    onKey(action) {
      if (action === 'yellow') {
        if (zone === 'menu') closeMenu();
        sortIndex = (sortIndex + 1) % SORTS.length;
        applyFilters();
        return true;
      }
      if (zone === 'menu') return menuKey(action);
      if (zone === 'bar') return barKey(action);
      switch (action) {
        case 'left': grid.move(-1, 0); return true;
        case 'right': grid.move(1, 0); return true;
        case 'up':
          if (grid.index < grid.cols || !grid.total) { zone = 'bar'; renderBar(); }
          else grid.move(0, -1);
          return true;
        case 'down':
          if (!grid.total) { zone = 'bar'; renderBar(); return true; }
          grid.move(0, 1);
          return true;
        case 'pageup': jump(-1); return true;
        case 'pagedown': jump(1); return true;
        case 'enter': grid.select(); return true;
        case 'play': case 'playpause': if (grid.current()) playItem(grid.current()); return true;
        case 'back':
          if (grid.index > grid.cols * 2) { grid.focusIndex(0); return true; }
          return false;
      }
      return false;
    },
  };
}
