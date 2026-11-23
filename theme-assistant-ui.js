import {themePresets,validateThemeSuggestions,scopedThemeColors,shuffleTheme} from './theme-engine.js';
const $=id=>document.getElementById(id);
const clone=value=>JSON.parse(JSON.stringify(value));

export function mountThemeAssistant({getState,setState,onMessage}) {
  let before=null, preview=null, aiThemes=[], activeRequest=null, serviceReady=false;
  function refresh() {
    const name=getState().themeLabel;
    $('activeThemeLabel').textContent=before?`Previewing: ${name}`:`Current theme: ${name}`;
    $('themePreviewBar').hidden=!before;
    document.querySelectorAll('#themePaletteList [data-theme-index], #presetThemeList [data-theme-index]').forEach(button=>button.setAttribute('aria-pressed',String(Boolean(before&&button.dataset.themeName===preview?.name))));
  }
  function previewTheme(theme) {
    if(!before) before=clone(getState());
    preview=clone(theme);
    const next={...before,colors:scopedThemeColors(before.colors,theme.colors,$('themeWholeRoom').checked),themeName:theme.id||'custom',themeLabel:theme.name,
      floralIntensity:theme.floralIntensity??before.floralIntensity,goldIntensity:theme.goldIntensity??before.goldIntensity};
    setState(next); refresh();
    $('themePreviewTips').replaceChildren();
    for(const tip of theme.tips||[]) { const p=document.createElement('p'); p.textContent=tip; $('themePreviewTips').append(p); }
    onMessage(`Previewing ${theme.name}. Keep the theme or restore your previous colours.`);
  }
  function commit() {
    if(!before) return;
    const name=getState().themeLabel; before=null; preview=null; refresh(); $('themePreviewTips').replaceChildren();
    onMessage(`${name} applied. Your room layout has been kept.`);
  }
  function revert(announce=true) {
    if(!before) return;
    const saved=before; before=null; preview=null; setState(saved); refresh(); $('themePreviewTips').replaceChildren();
    if(announce) onMessage('Previous colours restored.');
  }
  function card(theme,index) {
    const button=document.createElement('button'); button.className='themeCard'; button.dataset.themeIndex=index; button.dataset.themeName=theme.name; button.setAttribute('aria-pressed','false');
    const ribbon=document.createElement('span'); ribbon.className='themeRibbon'; ribbon.setAttribute('aria-hidden','true');
    for(const role of ['accent','deep','linen','gold','chairs']) { const chip=document.createElement('span'); chip.style.background=theme.colors[role]; ribbon.append(chip); }
    const name=document.createElement('strong'); name.textContent=theme.name;
    const description=document.createElement('span'); description.className='themeDescription'; description.textContent=theme.description;
    const action=document.createElement('span'); action.className='themeCardAction'; action.textContent='Preview in room';
    button.append(ribbon,name,description,action); button.onclick=()=>previewTheme(theme); return button;
  }
  function renderSuggestions() {
    $('themePaletteList').replaceChildren(); aiThemes.forEach((theme,index)=>$('themePaletteList').append(card(theme,index))); refresh();
  }
  themePresets.forEach((theme,index)=>$('presetThemeList').append(card(theme,`preset-${index}`)));
  $('keepTheme').onclick=commit; $('revertTheme').onclick=()=>revert();
  $('shuffleTheme').onclick=()=> { if(preview) previewTheme(shuffleTheme(preview)); };
  $('themeWholeRoom').onchange=()=> { if(preview) previewTheme(preview); };
  document.querySelectorAll('[data-theme-prompt]').forEach(button=>button.onclick=()=> { $('themePrompt').value=button.dataset.themePrompt; $('themePrompt').focus(); });

  function setBusy(busy) {
    $('suggestThemes').disabled=busy||!serviceReady; $('suggestThemes').textContent=busy?'Creating your themes…':'Suggest themes'; $('cancelThemes').hidden=!busy;
    $('themeAssistantForm').setAttribute('aria-busy',String(busy));
  }
  function connectAI(request) {
    // Open during the click gesture so the sign-in window is not popup-blocked.
    const popup=window.open('about:blank','mont-blanc-ai-stylist','popup,width=520,height=620');
    if(!popup) return Promise.reject(new Error('Allow the assistant’s sign-in window, then try again.'));
    const channel=crypto.randomUUID(); let origin, timer, closedTimer, listener, done=false;
    return new Promise((resolve,reject)=> {
      function finish(error,result) {
        if(done) return; done=true; clearTimeout(timer); clearInterval(closedTimer); if(listener) window.removeEventListener('message',listener);
        activeRequest=null; try { popup.close(); } catch { /* Window may already be closed. */ }
        error?reject(error):resolve(result);
      }
      activeRequest=()=>finish(new Error('Theme request cancelled. Your current colours have been kept.'));
      timer=setTimeout(()=>finish(new Error('The assistant could not connect. If you just signed in, close its window and try again.')),90000);
      closedTimer=setInterval(()=> { if(popup.closed&&!done) finish(new Error('The assistant window closed. Try again when you are ready.')); },750);
      fetch('./ai-config.json',{cache:'no-store'}).then(response=> { if(!response.ok) throw new Error('The AI assistant has not been configured.'); return response.json(); }).then(config=> {
        const url=new URL(config.backendOrigin); if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash) throw new Error('The AI connection is invalid.');
        if(done) return; origin=url.origin;
        listener=event=> {
          if(event.source!==popup||event.origin!==origin||event.data?.channel!==channel) return;
          if(event.data.type==='wedding-theme-ready') popup.postMessage({type:'wedding-theme-request',channel,request},origin);
          if(event.data.type==='wedding-theme-result') {
            if(event.data.error) { finish(new Error(event.data.error)); return; }
            try { finish(null,validateThemeSuggestions(event.data.result)); } catch(error) { finish(error); }
          }
        };
        window.addEventListener('message',listener);
        popup.location.replace(`${origin}/?origin=${encodeURIComponent(location.origin)}#${channel}`);
      }).catch(error=>finish(error));
    });
  }
  $('cancelThemes').onclick=()=>activeRequest?.();
  $('themeAssistantForm').onsubmit=async event=> {
    event.preventDefault(); if(activeRequest) return;
    const prompt=$('themePrompt').value.trim();
    if(prompt.length<3||prompt.length>1500) { $('themeAssistantStatus').textContent='Describe the mood in 3–1,500 characters.'; $('themePrompt').focus(); return; }
    setBusy(true); $('themeAssistantStatus').textContent='Connecting to your private AI stylist. Sign in if its window asks you to.';
    try {
      const suggestions=await connectAI({prompt,colors:getState().colors,previousNames:aiThemes.map(t=>t.name)});
      aiThemes=suggestions; renderSuggestions(); $('themeAssistantStatus').textContent='Three new themes are ready. Preview any palette, then keep your favourite.';
    } catch(error) { $('themeAssistantStatus').textContent=error.message; }
    finally { setBusy(false); }
  };
  setBusy(false);
  fetch('./ai-config.json',{cache:'no-store'}).then(response=> { if(!response.ok) throw new Error('AI connection unavailable.'); return response.json(); }).then(config=> {
    serviceReady=config.enabled===true; setBusy(false);
    if(!serviceReady) $('themeAssistantStatus').textContent='Live AI is awaiting secure account activation. You can preview and apply the ready-made themes below now.';
  }).catch(()=> { $('themeAssistantStatus').textContent='The AI connection is unavailable. Your colour controls and ready-made themes still work.'; });
  refresh();
  return {commit,revert,refresh};
}
