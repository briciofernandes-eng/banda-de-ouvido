//<CIFRA>
/* ============ CIFRA (analisador, sem DOM) ============ */
const CHORD_RE = /^([A-G])([#b]?)((?:maj|min|dim|aug|sus|add|m|M|º|°|ø|Δ|\+|-|\d+|#|b|\(|\)|,|\/(?=\d))*)(?:\/([A-G])([#b]?))?$/;
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = (l, a) => mod(LETTER_PC[l] + (a === '#' ? 1 : a === 'b' ? -1 : 0), 12);
function parseChord(tok) {
  const m = CHORD_RE.exec(tok); if (!m) return null;
  const q = m[3] || '', root = pcOf(m[1], m[2]), bass = m[4] ? pcOf(m[4], m[5]) : null;
  const half = /ø/.test(q) || /m7\(?b5/.test(q);
  const dim = /dim|º|°/.test(q) || half;
  const minor = /^(m(?!aj)|min|-)/.test(q) || dim;
  const aug = /aug|\+/.test(q);
  const sus2 = /sus2/.test(q), sus4 = (/sus(?!2)/.test(q) || /^4/.test(q)) && !sus2;
  const third = minor ? 3 : sus2 ? 2 : sus4 ? 5 : 4;
  const fifth = dim || /b5|5-/.test(q) ? 6 : aug || /#5|5\+/.test(q) ? 8 : 7;
  let seventh = null;
  if (/maj7|M7|7M|Δ|maj9|M9/.test(q)) seventh = 11;
  else if (/°7|dim7/.test(q)) seventh = 9;
  else if (/(7|11|13)/.test(q)) seventh = 10;
  else if (/9/.test(q) && !/add9/.test(q)) seventh = 10;
  else if (/6/.test(q)) seventh = 9;
  return { sym: tok, root, third: mod(root + third, 12), fifth: mod(root + fifth, 12), seventh: seventh == null ? null : mod(root + seventh, 12), bass, minor: third === 3 };
}
function transposeSym(sym, shift, flats) {
  const names = flats ? PC_FLAT : PC_SHARP;
  return sym.replace(/^([A-G])([#b]?)/, (m, l, a) => names[mod(pcOf(l, a) + shift, 12)])
            .replace(/\/([A-G])([#b]?)$/, (m, l, a) => '/' + names[mod(pcOf(l, a) + shift, 12)]);
}
function chordObj(c, shift, flats) {
  return { root: mod(c.root + shift, 12), third: mod(c.third + shift, 12), fifth: mod(c.fifth + shift, 12),
    seventh: c.seventh == null ? null : mod(c.seventh + shift, 12), bass: c.bass == null ? null : mod(c.bass + shift, 12),
    name: transposeSym(c.sym, shift, flats) };
}
const FILL = /^(\||\|\||-|–|—|\/|x\d+|\d+x|\(?\d+x\)?|\.{2,}|…|:|%|\*)$/i;
function chordLine(line) {
  const toks = line.trim().split(/\s+/).filter(Boolean), out = [];
  if (!toks.length) return null;
  for (let t of toks) {
    t = t.replace(/^[(\[|]+/, '').replace(/[\]|]+$/, '');
    while (t.endsWith(')') && (t.match(/\)/g) || []).length > (t.match(/\(/g) || []).length) t = t.slice(0, -1);
    if (!t) continue;
    if (parseChord(t)) out.push(t);
    else if (!FILL.test(t)) return null;
  }
  return out.length ? out : null;
}
const HEADER_RE = /^(intro|estrofe|refr[aã]o|ponte|solo|final|pr[eé][- ]?refr[aã]o|primeira parte|segunda parte|terceira parte|parte\s*\d*|verso|coro|interl[uú]dio|instrumental)\b[^\n]{0,30}$/i;
function parseChart(text) {
  const lines = String(text).replace(/\r/g, '').split('\n'), seq = [], sections = [];
  let sec = null, tom = null;
  const newSec = name => { sec = { name, rows: [] }; sections.push(sec); };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim(); if (!line) continue;
    let m;
    if ((m = /^tom\s*:\s*([A-Ga-g])([#b]?)\s*(m(?!aj)|min)?/i.exec(line))) { tom = { pc: pcOf(m[1].toUpperCase(), m[2]), minor: !!m[3] }; continue; }
    if (/^capotraste/i.test(line)) continue;
    let label = null, ch = null;
    if ((m = /^\[([^\]]+)\]\s*(.*)$/.exec(line))) {
      const rest = m[2].trim();
      if (!rest) { newSec(m[1].trim()); continue; }
      const c2 = chordLine(rest); if (c2) { label = m[1].trim(); ch = c2; }
    }
    if (!ch) ch = chordLine(line);
    if (!ch) {
      const lm = /^([A-Za-zÀ-ú0-9ºª ]{2,24}):\s*(.+)$/.exec(line);
      if (lm) { const c2 = chordLine(lm[2]); if (c2) { label = lm[1].trim(); ch = c2; } }
    }
    if (ch) {
      if (label) newSec(label); else if (!sec) newSec('');
      const row = { items: [], lyric: '' };
      for (const tok of ch) { seq.push(parseChord(tok)); row.items.push(seq.length - 1); }
      const nx = (lines[i + 1] || '').trim();
      if (nx && !chordLine(nx) && !/^\[/.test(nx) && !HEADER_RE.test(nx) && !/^tom\s*:/i.test(nx) && !/^capotraste/i.test(nx)) { row.lyric = nx; i++; }
      sec.rows.push(row); continue;
    }
    if (HEADER_RE.test(line)) { newSec(line.replace(/[:\s]+$/, '')); continue; }
    if (!sec) newSec('');
    sec.rows.push({ items: [], lyric: line });
  }
  let tonic = 0, minor = false;
  if (tom) { tonic = tom.pc; minor = tom.minor; }
  else if (seq.length) {
    const prof = new Array(12).fill(0);
    for (const c of seq) { prof[c.root] += 1; prof[c.third] += 0.8; prof[c.fifth] += 0.7; if (c.seventh != null) prof[c.seventh] += 0.2; }
    prof[seq[0].root] += 1.5; prof[seq[seq.length - 1].root] += 1.5;
    let best = 0, br = -2; for (let k = 0; k < 24; k++) { const r = pearson(prof, KEY_PROFILES[k]); if (r > br) { br = r; best = k; } }
    tonic = best % 12; minor = best >= 12;
  }
  return { seq, sections, tonic, minor, declared: !!tom };
}
//</CIFRA>
