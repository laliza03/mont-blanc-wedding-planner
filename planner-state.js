export const palettes = {
  lavender: { accent: '#a78cc7', deep: '#725b98', gold: '#caa85f' },
  amethyst: { accent: '#9175bd', deep: '#624886', gold: '#d0ad63' },
  sage: { accent: '#9eae96', deep: '#68775f', gold: '#caa85f' },
  blush: { accent: '#d0a9b5', deep: '#9e7682', gold: '#caa85f' },
  blue: { accent: '#9eb2cc', deep: '#697d99', gold: '#caa85f' }
};
export const defaultColors = {
  linen: '#f8f5ef', chairs: '#f8f5ef', walls: '#f7f4ef', floor: '#332f2e', dance: '#6a625e'
};
export const decorKinds = {
  flowers: 'Floral arrangement', candles: 'Candle trio', arch: 'Wedding arch',
  backdrop: 'Draped backdrop', vase: 'Tall vase', plant: 'Greenery',
  lantern: 'Lantern', runner: 'Aisle runner'
};
export const stationIds = ['photo', 'polaroid', 'video', 'advice', 'cake', 'dj'];
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function seatDistribution(count = 10, total = 95) {
  count = clamp(Math.round(Number(count) || 10), 8, 10);
  total = clamp(Math.round(Number(total) || 95), 1, 120);
  return Array.from({ length: count }, (_, i) => Math.floor(total / count) + (i < total % count ? 1 : 0));
}
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
const isColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
function number(value, fallback, min, max) {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}
function text(value, fallback = '') {
  return typeof value === 'string' ? value.slice(0, 200) : fallback;
}

// Validate the entire file before the caller changes the current room.
// Version 3 is the original planner format; absent station objects meant "off".
export function normalizePlan(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !Array.isArray(data.objects) || !data.objects.length ||
      !data.objects.some(o => /^t(?:[1-9]|10)$/.test(o?.id)) ||
      (data.version !== undefined && ![1, 2, 3, 4].includes(data.version))) {
    throw new Error('Choose a wedding plan exported by this planner. Your current room has been kept.');
  }
  if (data.objects.length > 200 || (data.guests?.length || 0) > 500 || (data.shopping?.length || 0) > 500) {
    throw new Error('This plan is too large. The room supports up to 180 decorations.');
  }
  const tableCount = Math.round(number(data.tableCount, 10, 8, 10));
  const guestTarget = Math.round(number(data.guestTarget, 95, 1, 120));
  const themeName = data.themeName==='custom'||Object.hasOwn(palettes, data.themeName) ? data.themeName : 'lavender';
  const themeLabel = text(data.themeLabel,themeName==='custom'?'My custom colours':`${themeName[0].toUpperCase()}${themeName.slice(1)}`);
  const colors = { ...defaultColors, ...(palettes[themeName]||palettes.lavender) };
  for (const key of Object.keys(colors)) if (isColor(data.colors?.[key])) colors[key] = data.colors[key];
  const ids = new Set();
  const objects = data.objects.map(o => {
    if (!o || typeof o.id !== 'string' || ids.has(o.id) ||
        !Array.isArray(o.pos) || o.pos.length !== 3 || !o.pos.every(Number.isFinite)) {
      throw new Error('A room object has invalid or duplicate placement data. Your current room has been kept.');
    }
    ids.add(o.id);
    const isDecor = o.type === 'decor';
    if (isDecor ? !Object.hasOwn(decorKinds, o.kind) || !/^decor-[\w-]+$/.test(o.id) :
        !/^t(?:[1-9]|10)$/.test(o.id) && ![...stationIds, 'sweetheart'].includes(o.id)) {
      throw new Error('This plan contains an unknown room object. Your current room has been kept.');
    }
    return {
      id: o.id, type: isDecor ? 'decor' : o.id.startsWith('t') ? 'table' : 'station',
      ...(isDecor ? { kind: o.kind, color: isColor(o.color) ? o.color : null, label: text(o.label),
        anchor: [...stationIds,'sweetheart',...Array.from({length:tableCount},(_,i)=>`t${i+1}`)].includes(o.anchor) ? o.anchor : null } : {}),
      pos: [clamp(o.pos[0], -17, 17), clamp(o.pos[1], 0, 8), clamp(o.pos[2], -30, 30)],
      rot: number(o.rot, 0, -Math.PI * 100, Math.PI * 100),
      scale: number(o.scale, 1, .4, 2)
    };
  });
  const validTables = new Set(Array.from({ length: tableCount }, (_, i) => `t${i + 1}`));
  const guests = Array.isArray(data.guests) ? data.guests.filter(g => g && typeof g.name === 'string').map(g => ({
    name: text(g.name), side: ['Bride family', 'Groom family', 'Friends'].includes(g.side) ? g.side : 'Friends',
    table: validTables.has(g.table) ? g.table : ''
  })) : [];
  // Overflow guests remain visible and become unassigned, never silently overbooked.
  const capacities = seatDistribution(tableCount, guestTarget);
  const used = new Map();
  for (const g of guests) {
    const count = used.get(g.table) || 0;
    if (g.table && count < capacities[Number(g.table.slice(1)) - 1]) used.set(g.table, count + 1);
    else g.table = '';
  }
  return {
    version: 4, themeName, themeLabel, colors, tableCount, guestTarget, objects, guests,
    floralIntensity: number(data.floralIntensity, .35, 0, 1),
    goldIntensity: number(data.goldIntensity, 1.25, .5, 1.8),
    shopping: Array.isArray(data.shopping) ? data.shopping.filter(it => it && typeof it.name === 'string').map(it => ({
      name: text(it.name), price: number(it.price, 0, 0, 1000000),
      qty: Math.round(number(it.qty, 1, 1, 10000)), url: safeUrl(it.url)
    })) : [],
    stations: Object.fromEntries(stationIds.map(id => [id, typeof data.stations?.[id] === 'boolean' ? data.stations[id] : ids.has(id)])),
    display: { walls: data.display?.walls !== false, labels: data.display?.labels !== false }
  };
}
