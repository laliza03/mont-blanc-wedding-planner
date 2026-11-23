export const colorRoles = ['accent','deep','gold','linen','chairs','walls','floor','dance'];
export const decorColorRoles = ['accent','deep','gold','linen','chairs'];
export const themePresets = [
  {id:'lavender',name:'Lavender garden',description:'Soft lilac, ivory and warm gold.',colors:{accent:'#a78cc7',deep:'#725b98',gold:'#caa85f',linen:'#f8f5ef',chairs:'#f8f5ef',walls:'#f7f4ef',floor:'#332f2e',dance:'#80746c'}},
  {id:'sage',name:'Olive & ivory',description:'Botanical greens with candlelit gold.',colors:{accent:'#9eae96',deep:'#52664b',gold:'#bba063',linen:'#f7f3e8',chairs:'#f7f3e8',walls:'#f4f2e9',floor:'#332f2e',dance:'#867b69'}},
  {id:'blush',name:'Rosewater',description:'Dusty pink, soft cream and champagne.',colors:{accent:'#d6a6b5',deep:'#9e576c',gold:'#c5a67d',linen:'#fff3ef',chairs:'#faf6f0',walls:'#f8f0eb',floor:'#3f3432',dance:'#a58d85'}},
  {id:'blue',name:'Blue hour',description:'Dusty blue, porcelain and silver.',colors:{accent:'#91abc9',deep:'#405875',gold:'#bec7d1',linen:'#f1f4f7',chairs:'#f7f7f6',walls:'#eef1f4',floor:'#303743',dance:'#6e7b8c'}},
  {id:'custom',name:'Burgundy velvet',description:'Wine red with ivory and antique brass.',colors:{accent:'#893d52',deep:'#532c43',gold:'#ba944e',linen:'#f4e8df',chairs:'#f3eee8',walls:'#efe6e0',floor:'#332c31',dance:'#827076'}},
  {id:'custom',name:'Terracotta sunset',description:'Clay, peach and linen for a warm reception.',colors:{accent:'#c67e64',deep:'#8c4d45',gold:'#bd9a63',linen:'#faeadb',chairs:'#f4ebde',walls:'#f1e3d5',floor:'#45332d',dance:'#a17d65'}},
  {id:'custom',name:'Emerald evening',description:'Deep green, porcelain and polished gold.',colors:{accent:'#39745d',deep:'#234d42',gold:'#d2b16a',linen:'#f5f2e8',chairs:'#f6f3ec',walls:'#eeeee7',floor:'#28332e',dance:'#6f7b68'}},
  {id:'custom',name:'Midnight & champagne',description:'Navy, warm white and a touch of champagne.',colors:{accent:'#425375',deep:'#28344c',gold:'#c9b38b',linen:'#f4eee2',chairs:'#f6f3ed',walls:'#f0ede7',floor:'#2c3038',dance:'#777b83'}}
].map(theme=>({...theme,floralIntensity:.45,goldIntensity:1.25,tips:[]}));
export function validateThemeSuggestions(value) {
  if(!value || !Array.isArray(value.themes) || value.themes.length<1 || value.themes.length>3) throw new Error('The AI returned an incomplete palette. Please try again.');
  return value.themes.map((theme,index)=> {
    if(!theme || typeof theme.name!=='string' || !theme.name.trim() || theme.name.length>80 ||
      typeof theme.description!=='string' || theme.description.length>300 ||
      !colorRoles.every(role=>/^#[0-9a-f]{6}$/i.test(theme.colors?.[role])) ||
      !Number.isFinite(theme.floralIntensity) || theme.floralIntensity<0 || theme.floralIntensity>1 ||
      !Number.isFinite(theme.goldIntensity) || theme.goldIntensity<.5 || theme.goldIntensity>1.8 ||
      !Array.isArray(theme.tips) || theme.tips.length>3 || theme.tips.some(t=>typeof t!=='string'||t.length>240)) throw new Error('The AI returned an invalid palette. Your current design has been kept.');
    return {id:'custom',name:theme.name.trim(),description:theme.description,colors:Object.fromEntries(colorRoles.map(role=>[role,theme.colors[role]])),
      floralIntensity:theme.floralIntensity,goldIntensity:theme.goldIntensity,tips:[...theme.tips],source:'ai',key:`ai-${index}`};
  });
}
export function scopedThemeColors(current, proposed, wholeRoom=false) {
  const result={...current};
  for(const role of wholeRoom?colorRoles:decorColorRoles) if(/^#[0-9a-f]{6}$/i.test(proposed[role])) result[role]=proposed[role];
  return result;
}
export function shuffleTheme(theme) {
  return {...theme,colors:{...theme.colors,accent:theme.colors.deep,deep:theme.colors.linen,linen:theme.colors.accent,chairs:theme.colors.accent}};
}
