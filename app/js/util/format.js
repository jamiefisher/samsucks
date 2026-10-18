export function duration(ms) {
  if (!ms) return '';
  const min = Math.round(ms / 60000);
  if (min < 60) return min + 'm';
  return Math.floor(min / 60) + 'h ' + (min % 60) + 'm';
}

export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = n => (n < 10 ? '0' : '') + n;
  return (hh ? hh + ':' + pad(mm) : mm) + ':' + pad(ss);
}

export function episodeLabel(item) {
  if (item.type !== 'episode') return '';
  return 'S' + (item.parentIndex || 0) + ' · E' + (item.index || 0);
}

// The line under a title: "2019 · PG-13 · 2h 4m" style.
export function metaLine(item, { stars = true } = {}) {
  const parts = [];
  if (item.type === 'episode') {
    parts.push(episodeLabel(item));
    if (item.originallyAvailableAt) parts.push(item.originallyAvailableAt.slice(0, 4));
  } else if (item.year) {
    parts.push(item.year);
  }
  if (item.contentRating) parts.push(item.contentRating);
  if (item.type === 'show' && item.childCount) parts.push(item.childCount + (item.childCount === 1 ? ' season' : ' seasons'));
  else if (item.duration) parts.push(duration(item.duration));
  if (stars && item.audienceRating) parts.push('★ ' + Number(item.audienceRating).toFixed(1));
  return parts.join('  ·  ');
}

export function progress(item) {
  if (!item.viewOffset || !item.duration) return 0;
  return Math.min(1, item.viewOffset / item.duration);
}

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Critic and audience scores with where they're from, e.g.
// [{ icon: 'tomato', text: '92%', label: 'Rotten Tomatoes' }]. Plex scores are 0-10;
// the image URI says whose score it is and which way it went.
export function ratings(item) {
  const out = [];
  const add = (value, image, critic) => {
    if (value == null || value === '') return;
    const v = Number(value);
    const src = String(image || '');
    if (/^rottentomatoes:/.test(src)) {
      const icon = critic ? (/\.rotten$/.test(src) ? 'splat' : 'tomato') : (/\.spilled$/.test(src) ? 'spilled' : 'popcorn');
      out.push({ icon, text: Math.round(v * 10) + '%', label: critic ? 'Tomatometer' : 'Audience' });
    } else if (/^imdb:/.test(src)) {
      out.push({ icon: 'imdb', text: v.toFixed(1), label: 'IMDb' });
    } else if (/^themoviedb:/.test(src)) {
      out.push({ icon: 'tmdb', text: Math.round(v * 10) + '%', label: 'TMDB' });
    } else {
      out.push({ icon: '', text: '★ ' + v.toFixed(1), label: critic ? 'Critics' : 'Audience' });
    }
  };
  // Newer servers list every source in Rating[]; older ones only have the two fields.
  if (item.Rating && item.Rating.length) {
    item.Rating.forEach(r => add(r.value, r.image, r.type === 'critic'));
  } else {
    add(item.rating, item.ratingImage, true);
    add(item.audienceRating, item.audienceRatingImage, false);
  }
  const seen = {};
  return out.filter(r => !seen[r.icon + r.label] && (seen[r.icon + r.label] = true));
}
