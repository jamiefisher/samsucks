// An actor or director: everything they're in, one row per library on the
// server the item came from (tag ids are per server), newest first.
import { h, setText, setTransform } from '../util/dom.js';
import { Row } from '../ui/row.js';
import { useAmbience, HeroArt } from '../ui/backdrop.js';
import { serverOf } from '../session.js';
import { metaLine } from '../util/format.js';
import { isFast } from '../input.js';
import { openItem, playItem } from '../nav.js';
import { error } from '../util/log.js';

const ROWS_TOP = 400;

export function PersonScreen(person) {
  const server = serverOf(person);
  const el = h('div', 'screen person');
  const ambience = useAmbience();
  const art = new HeroArt(el, 'hero-art detail-art');
  const head = h('div', 'person-head', el);
  const photo = h('div', 'person-photo', head);
  const img = h('img', '', photo);
  const text = h('div', 'person-text', head);
  h('h1', 'person-name', text).textContent = person.title;
  const sub = h('div', 'person-sub', text);
  const focusInfo = h('div', 'person-focus', el);
  const clip = h('div', 'person-rows', el);
  clip.style.top = ROWS_TOP + 'px';
  const track = h('div', 'rows-track', clip);

  if (person.thumb) img.src = server.image(person.thumb, 220, 220);
  else { photo.classList.add('empty'); photo.textContent = initials(person.title); }
  setText(sub, 'Looking through ' + server.name + '…');

  let rows = [];
  let rowIndex = 0;
  let alive = true;
  let artTimer = 0;

  function initials(name) {
    return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  function onFocus(item) {
    if (!item) return;
    setText(focusInfo, item.title + '   ' + metaLine(item));
    ambience.set(item.UltraBlurColors);
    clearTimeout(artTimer);
    artTimer = setTimeout(() => art.set(server.image(item.art, 1920, 1080)), isFast() ? 350 : 120);
  }

  function render() {
    rows.forEach((r, i) => r.setActive(i === rowIndex));
    setTransform(track, 'translateY(' + (-(rows[rowIndex] ? rows[rowIndex].y : 0)) + 'px)');
  }

  async function load() {
    try {
      const sections = await server.sections();
      const results = await Promise.all(sections.map(sec => {
        const type = sec.type === 'show' ? 2 : 1;
        return server.get('/library/sections/' + sec.key + '/all', Object.assign({
          type, sort: 'originallyAvailableAt:desc', excludeFields: 'summary,tagline',
        }, person.params)).then(mc => ({ sec, items: mc.Metadata || [] }), () => ({ sec, items: [] }));
      }));
      if (!alive) return;
      const found = results.filter(r => r.items.length);
      let y = 0;
      rows = found.map(({ sec, items }) => {
        const row = new Row({
          title: sec.title + '  ·  ' + items.length, kind: 'poster', caption: true, items,
          onFocus, onSelect: it => openItem(it),
        });
        setTransform(row.el, 'translateY(' + y + 'px)');
        row.y = y;
        y += row.height;
        track.appendChild(row.el);
        return row;
      });
      const total = found.reduce((n, r) => n + r.items.length, 0);
      setText(sub, total ? total + (total === 1 ? ' title' : ' titles') + ' on ' + server.name
        : 'Nothing else with ' + person.title + ' on ' + server.name);
      render();
      if (rows[0]) onFocus(rows[0].current());
    } catch (e) {
      error('person load failed', person.title, e);
      setText(sub, 'Couldn\'t load from ' + server.name);
    }
  }
  load();

  return {
    el,
    name: 'person',
    onShow() { ambience.restore(); },
    onKey(action) {
      const row = rows[rowIndex];
      if (!row) return false;
      switch (action) {
        case 'left': row.move(-1); return true;
        case 'right': row.move(1); return true;
        case 'up': if (rowIndex > 0) { rowIndex--; render(); onFocus(rows[rowIndex].current()); } return true;
        case 'down': if (rowIndex < rows.length - 1) { rowIndex++; render(); onFocus(rows[rowIndex].current()); } return true;
        case 'enter': row.select(); return true;
        case 'play': case 'playpause': if (row.current()) playItem(row.current()); return true;
      }
      return false;
    },
    destroy() { alive = false; clearTimeout(artTimer); },
  };
}
