(()=>{
  const assets=window.SNAKE_ASSETS||{};
  const aliases={
    '/logos/fnbx/snake_arcade/pixel/v18/px_count_04.png':'/logos/fnbx/snake_arcade/v18/count_04.png',
    '/logos/fnbx/snake_arcade/pixel/v18/px_count_05.png':'/logos/fnbx/snake_arcade/v18/count_05.png',
    '/logos/fnbx/snake_arcade/halloween/default_jackolantern.png':'/logos/fnbx/snake_arcade/v3/apple_00.png',
    '/logos/fnbx/snake_arcade/pixel/px_dc_trophy.png':'/logos/fnbx/snake_arcade/dc_trophy.png'
  };
  for(const [missing,fallback] of Object.entries(aliases)) if(!assets[missing]&&assets[fallback]) assets[missing]=assets[fallback];
  const keys=value=>{
    let raw=typeof value==='string'?value:value&&value.url;
    if(!raw||/^(data|blob):/i.test(raw)) return [];
    if(raw.startsWith('//')) raw='https:'+raw;
    try{const u=new URL(raw,'https://www.google.com/fbx?fbx=snake_arcade');return [u.href,u.pathname+u.search,u.pathname]}catch{return [raw]}
  };
  const find=value=>{for(const key of keys(value)) if(assets[key]) return assets[key];return null};
  const dataURL=e=>`data:${e.mime};base64,${e.data}`;
  const shim=(proto,prop)=>{if(!proto)return;const d=Object.getOwnPropertyDescriptor(proto,prop);if(!d?.get||!d?.set)return;Object.defineProperty(proto,prop,{...d,set(value){const e=find(value);return d.set.call(this,e?dataURL(e):value)}})};
  shim(window.HTMLImageElement?.prototype,'src');shim(window.HTMLAudioElement?.prototype,'src');shim(window.HTMLSourceElement?.prototype,'src');shim(window.HTMLLinkElement?.prototype,'href');
  const oldSet=Element.prototype.setAttribute;Element.prototype.setAttribute=function(name,value){if(/^(src|href)$/i.test(name)){const e=find(value);if(e)value=dataURL(e)}return oldSet.call(this,name,value)};
  const oldOpen=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url){const e=find(url);if(e)arguments[1]=dataURL(e);return oldOpen.apply(this,arguments)};
  const oldFetch=window.fetch?.bind(window);if(oldFetch)window.fetch=function(input,init){const e=find(input);return oldFetch(e?dataURL(e):input,init)};
  navigator.sendBeacon=()=>true;
})();
