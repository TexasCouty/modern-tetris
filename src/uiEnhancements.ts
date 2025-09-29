// UI enhancement and utility scripts extracted from inline HTML to avoid HTML parser issues.

(() => {
  // Scoreboard enhancements
  const nf = new Intl.NumberFormat('en-US');
  const scoreEl = document.getElementById('scoreVal');
  const levelEl = document.getElementById('levelVal');
  const linesEl = document.getElementById('linesVal');
  const highVal = document.getElementById('highVal');
  const scoreStat = document.getElementById('score');
  const levelProgress = document.getElementById('levelProgress');
  const scoreDelta = document.getElementById('scoreDelta');
  const toastLayer = document.getElementById('toastLayer');
  let lastScore = 0;
  function showToast(text: string, opts: { type?: string; ttl?: number } = {}) {
    if(!toastLayer) return; const div = document.createElement('div');
    div.className = 'toast ' + (opts.type||''); div.textContent = text;
    toastLayer.appendChild(div);
    setTimeout(()=> div.classList.add('out'), opts.ttl || 1600);
    setTimeout(()=> div.remove(), (opts.ttl||1600)+480);
  }
  window.addEventListener('tetris-level-up', (e: any) => {
    const { level } = e.detail;
    showToast('LEVEL '+ level, { type:'good', ttl: 1700 });
    scoreStat?.classList.add('pulse');
    setTimeout(()=> scoreStat?.classList.remove('pulse'), 620);
  });
  window.addEventListener('tetris-line-clear', (e: any) => {
    const { cleared, score } = e.detail;
    if (cleared === 4) { showToast('TETRIS +' + nf.format(score - lastScore), { type:'good', ttl:1900 }); }
    else if (cleared === 3) { showToast('TRIPLE', { type:'good', ttl:1400 }); }
    else if (cleared === 2) { showToast('DOUBLE', { ttl:1200 }); }
    else if (cleared === 1) { showToast('LINE', { ttl:1000 }); }
    if (scoreDelta && score > lastScore) {
      scoreDelta.textContent = '+' + nf.format(score - lastScore);
      scoreDelta.classList.add('visible');
      setTimeout(()=> scoreDelta.classList.remove('visible'), 1200);
    }
    lastScore = score;
  });
  // Removed MutationObserver loop; main.ts now updates progress + formatting directly.
})();

(() => {
  // Logo handling & recolor fallback logic
  const params = new URLSearchParams(location.search);
  const paramLogo = params.get('logo');
  // @ts-ignore
  const globalLogo = (window && (window as any).__TETRIS_LOGO_URL__) || undefined;
  const fallbackSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="54" viewBox="0 0 220 54"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#4f7ff9"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><rect width="220" height="54" rx="10" fill="rgba(255,255,255,0.04)"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-family="Segoe UI,Inter,Arial,sans-serif" font-size="30" font-weight="600" fill="url(#g)">TETRIS</text></svg>');
  const el = document.getElementById('gameLogo') as HTMLImageElement | null;
  if(!el) return;
  const candidate = paramLogo || globalLogo || '/logo.png';
  el.src = candidate;
  el.addEventListener('error', () => { el.src = fallbackSvg; });
  el.addEventListener('load', () => {
    if(el.dataset.processed) return;
    if(/^data:image\/svg/.test(el.src)) return;
    try {
      const canvas = document.createElement('canvas');
      const w = canvas.width = el.naturalWidth || el.width;
      const h = canvas.height = el.naturalHeight || el.height;
      if(!w || !h) return;
      const ctx = canvas.getContext('2d', { willReadFrequently:true });
      if(!ctx) return;
      ctx.drawImage(el, 0, 0);
      let imgData: ImageData;
      try { imgData = ctx.getImageData(0,0,w,h); } catch { return; }
      const d = imgData.data;
      let sumR=0,sumG=0,sumB=0,count=0;
      for(let i=0;i<d.length;i+=4){
        const a = d[i+3]; if(a < 180) continue;
        const r=d[i],g=d[i+1],b=d[i+2];
        if(r>215 && g>215 && b>215) continue;
        sumR+=r; sumG+=g; sumB+=b; count++;
      }
      if(!count) return;
      const avgR=sumR/count, avgG=sumG/count, avgB=sumB/count;
      const darken = (c:number)=> Math.max(0, Math.min(255, Math.round(c*0.38)));
      const strokeR = darken(avgR);
      const strokeG = darken(avgG);
      const strokeB = darken(avgB);
      for(let i=0;i<d.length;i+=4){
        const a = d[i+3]; if(a < 50) continue;
        const r=d[i],g=d[i+1],b=d[i+2];
        if(r>215 && g>215 && b>215){
          d[i]=strokeR; d[i+1]=strokeG; d[i+2]=strokeB;
        }
      }
      ctx.putImageData(imgData,0,0);
      el.src = canvas.toDataURL('image/png');
      el.dataset.processed = 'true';
    } catch {}
  });
})();

(() => {
  // Mobile repeat buttons
  const btnL = document.getElementById('btnLeft');
  const btnR = document.getElementById('btnRight');
  const btnD = document.getElementById('btnDown');
  if(!btnL||!btnR||!btnD) return;
  function repeater(el: Element, fire: ()=>void){
    let t: any, hold=false;
    const start = (e: Event)=>{ e.preventDefault(); fire(); hold=true; let delay=260; const loop=()=>{ if(!hold) return; fire(); delay = Math.max(55, delay*0.75); t=setTimeout(loop, delay); }; t=setTimeout(loop, delay); };
    const end=()=>{ hold=false; if(t) clearTimeout(t); };
    el.addEventListener('pointerdown', start as any, {passive:false});
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }
  repeater(btnL, ()=>window.dispatchEvent(new CustomEvent('tetris-btn-left')));
  repeater(btnR, ()=>window.dispatchEvent(new CustomEvent('tetris-btn-right')));
  repeater(btnD, ()=>window.dispatchEvent(new CustomEvent('tetris-btn-down')));
})();

(() => {
  // Height sync
  function syncHeights(){
    const panel = document.querySelector('.panel') as HTMLElement | null;
    const wrap = document.getElementById('gameWrap');
    if(!panel || !wrap) return;
    if(window.innerWidth <= 520){
      wrap.style.height = '';
      return;
    }
    const h = panel.getBoundingClientRect().height;
    wrap.style.height = h + 'px';
  }
  window.addEventListener('load', () => { syncHeights(); setTimeout(syncHeights, 50); });
  window.addEventListener('resize', syncHeights);
})();
