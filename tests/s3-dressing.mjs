// Session 3 test: fonts + lettering + dressing. Headless Chrome over the DevTools protocol (no deps; Node 22+).
// Usage: node tests/s3-dressing.mjs <samplesDir> <outDir>
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(new URL('../app', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const samples = resolve(process.argv[2]), out = resolve(process.argv[3]);
mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.jpg': 'image/jpeg' };
const srv = createServer((q, r) => {
  const p = join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(root) || !existsSync(p)) { r.writeHead(404).end(); return; }
  r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }).end(readFileSync(p));
}).listen(0);
const port = srv.address().port;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9333', '--no-first-run', '--window-size=1600,1000',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gp-'))}`, 'about:blank'], { stdio: 'ignore' });
let results = [], fails = 0;
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`); if (!ok) fails++; };

async function main() {
  let tab; for (let i = 0; i < 50 && !tab; i++) {
    try { tab = (await (await fetch('http://127.0.0.1:9333/json')).json()).find((t) => t.type === 'page'); } catch {}
    if (!tab) await new Promise((r) => setTimeout(r, 200));
  }
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map(); const errs = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
  await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
  for (let i = 0; i < 100; i++) { if (await ev('!!window.GODPOSTER').catch(() => false)) break; await new Promise((r) => setTimeout(r, 100)); }

  // ---- fonts ----
  check('document.fonts.check Anton', await ev(`document.fonts.check('40px Anton')`));
  check('document.fonts.check Yellowtail', await ev(`document.fonts.check('40px Yellowtail')`));
  check('FontFace entries loaded', await ev(`[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family).sort().join()`) === 'Anton,Yellowtail');

  // ---- load starter samples through the file input ----
  const doc = await send('DOM.getDocument');
  const { result: { nodeId } } = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#file' });
  await send('DOM.setFileInputFiles', { nodeId, files: [join(samples, 'heroine.jpg'), join(samples, 'yacht.jpg')] });
  for (let i = 0; i < 100 && (await ev('GODPOSTER.state.photos.length')) < 7; i++) await new Promise((r) => setTimeout(r, 100));
  check('5 bundled + 2 file-input photos loaded', (await ev('GODPOSTER.state.photos.length')) === 7);
  await ev(`GODPOSTER.setLayout('hero-left'); GODPOSTER.setSize('landscape'); document.getElementById('spread').click(); GODPOSTER.render()`);
  check('layout HERO LEFT @1920x1080, no titleRect', await ev(`GODPOSTER.state.layoutId==='hero-left' && GODPOSTER.state.size.w===1920 && GODPOSTER.state.size.h===1080 && GODPOSTER.state.titleRect===null`));

  // helper installed in page: dressing-only render on a transparent canvas -> pixel analysis
  await ev(`window.dress = (W=GODPOSTER.state.size.w,H=GODPOSTER.state.size.h)=>{const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});GODPOSTER.renderDressing(x,W,H);return {c,x,d:x.getImageData(0,0,W,H)}};
  window.near=(d,W,r,g,b,tol,x0=0,y0=0,x1=W,y1=d.height,amin=250)=>{let n=0,minx=1e9,maxx=-1,miny=1e9,maxy=-1;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*W+x)*4;if(d.data[i+3]<amin)continue;if(Math.abs(d.data[i]-r)<=tol&&Math.abs(d.data[i+1]-g)<=tol&&Math.abs(d.data[i+2]-b)<=tol){n++;if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y}}return {n,minx,maxx,miny,maxy}}`);

  // ---- HERO LEFT 1920x1080 ----
  const W = 1920, H = 1080;
  const title = await ev(`(()=>{const {d}=dress();const f=(r,g,b,t,...a)=>near(d,${W},r,g,b,t,...a);
    const cream=f(255,243,214,10), amber=f(255,179,71,12), red=f(255,94,58,12), pink=f(255,79,163,14), gold=f(232,185,49,10), shadow=f(26,11,38,4), stroke=f(43,16,48,4);
    return {cream,amber,red,pink,gold,shadow,stroke}})()`);
  const t = title;
  check('title gradient: cream top, amber, red bottom (top-to-bottom order)', t.cream.n > 500 && t.amber.n > 500 && t.red.n > 500 && t.cream.miny < t.amber.miny && t.amber.miny < t.red.miny, `cream y${t.cream.miny}..${t.cream.maxy}, amber ${t.amber.miny}..${t.amber.maxy}, red ${t.red.miny}..${t.red.maxy}`);
  // exact gradient colours down a column through the title's tallest glyph stem
  const col = await ev(`(()=>{const {d}=dress();const W=${W};const y0=${t.cream.miny},y1=${t.red.maxy};let best=null;
    for(let x=${t.cream.minx};x<${t.cream.maxx};x+=2){let s=[];for(let y=y0;y<=y1;y++){const i=(y*W+x)*4;s.push([d.data[i],d.data[i+1],d.data[i+2],d.data[i+3]])}
      const solid=s.filter(p=>p[3]===255&&!(p[0]<60)).length;if(!best||solid>best.solid)best={x,solid,s}}
    const px=(f)=>best.s[Math.round((best.s.length-1)*f)];return {x:best.x,top:px(.02),mid:px(.55),bot:px(.98),solid:best.solid,len:best.s.length}})()`);
  const dist = (a, b) => Math.max(...a.slice(0, 3).map((v, i) => Math.abs(v - b[i])));
  check('gradient samples on a stem: top≈#fff3d6, 55%≈#ffb347, bottom≈#ff5e3a', dist(col.top, [255, 243, 214]) < 45 && dist(col.mid, [255, 179, 71]) < 45 && dist(col.bot, [255, 94, 58]) < 45, `top ${col.top} mid ${col.mid} bot ${col.bot}`);
  const titleW = t.cream.maxx - t.cream.minx;
  check('title fits within 92% of W', t.red.maxx - t.cream.minx + 1 <= 0.92 * W + 1, `fill width ${t.red.maxx - t.cream.minx}px of ${0.92 * W | 0}`);
  check('hard shadow + stroke colours present', t.shadow.n > 200 && t.stroke.n > 200, `shadow ${t.shadow.n}px stroke ${t.stroke.n}px`);
  check('shadow offset to lower-right of stroke/fill', t.shadow.maxx >= t.stroke.maxx && t.shadow.maxy >= t.stroke.maxy, `shadow max (${t.shadow.maxx},${t.shadow.maxy}) stroke max (${t.stroke.maxx},${t.stroke.maxy})`);
  check('subtitle pink drawn, starts ~52% of title width', t.pink.n > 300 && Math.abs((t.pink.minx - t.cream.minx) / (t.red.maxx - t.cream.minx) - .52) < .1, `pink n=${t.pink.n} x ${t.pink.minx}..${t.pink.maxx}, ratio ${((t.pink.minx - t.cream.minx) / (t.red.maxx - t.cream.minx)).toFixed(2)}`);
  check('subtitle within canvas right margin', t.pink.maxx <= W * .97, `max x ${t.pink.maxx}`);
  const quoteArea = await ev(`(()=>{const {d}=dress();const g=near(d,${W},232,185,49,10,0,0,${W},${t.cream.miny - 2});const w=near(d,${W},255,255,255,6,0,0,${W},${t.cream.miny - 2});return {g,w}})()`);
  check('quote line drawn above title (gold stars/source + white text)', quoteArea.g.n > 100 && quoteArea.w.n > 100, `gold ${quoteArea.g.n}px, white ${quoteArea.w.n}px, gold x≥${quoteArea.g.minx} (4% W=${W * .04 | 0})`);
  check('quote left-aligned at ~4% of W', Math.abs(quoteArea.g.minx - W * .04) < W * .01, `min x ${quoteArea.g.minx}`);
  const strip = await ev(`(()=>{const {d}=dress();const y0=${H - 110};return {cream:near(d,${W},255,243,214,10,0,y0,${W},${H}),gold:near(d,${W},232,185,49,10,0,y0,${W},${H}),micro:near(d,${W},170,170,170,70,0,${H - 25},${W * .5},${H - 8},200),bar:near(d,${W},255,255,255,3,${W * .8},${H - 70},${W},${H})}})()`);
  check('tagline (cream) in bottom strip, centred', strip.cream.n > 200 && Math.abs((strip.cream.minx + strip.cream.maxx) / 2 - W / 2) < W * .02, `x ${strip.cream.minx}..${strip.cream.maxx}`);
  check('two gold rules flank tagline', strip.gold.n > 200 && strip.gold.minx <= W * .05 && strip.gold.maxx >= W * .95, `gold x ${strip.gold.minx}..${strip.gold.maxx}`);
  check('microprint drawn bottom-left', strip.micro.n > 50 && strip.micro.minx >= W * .035, `n=${strip.micro.n} x≥${strip.micro.minx}`);
  check('barcode drawn bottom-right, height ≈0.02W', strip.bar.n > 200 && Math.abs((strip.bar.maxy - strip.bar.miny + 1) - W * .02) <= 3 && strip.bar.maxx <= W * .97, `bbox x ${strip.bar.minx}..${strip.bar.maxx} y ${strip.bar.miny}..${strip.bar.maxy} h=${strip.bar.maxy - strip.bar.miny + 1} (target ${W * .02 | 0})`);
  const bars = (await ev(`(()=>{const {d}=dress();const y=${strip.bar.miny + 3};let s='';for(let x=${W * .8 | 0};x<${W};x++){s+=d.data[(y*${W}+x)*4+3]>200?'1':'0'}return s})()`)).match(/1+/g) || [];
  check('barcode has ~40 bars', Math.abs(bars.length - 40) <= 4, `${bars.length} bars, widths ${[...new Set(bars.map((b) => b.length))].sort()}`);
  const bc = (expr) => ev(`(()=>{const {d}=dress();let s='';const y=${strip.bar.miny + 3};for(let x=${W * .8 | 0};x<${W};x++)s+=d.data[(y*${W}+x)*4+3]>200?1:0;return s})()`);
  const a1 = await bc(), a2 = await bc();
  await ev(`GODPOSTER.state.texts.title='OTHER TITLE'`);
  const a3 = await bc(); await ev(`GODPOSTER.state.texts.title='PALM HEAT'`);
  check('barcode stable per title, differs for another title', a1 === a2 && a1 !== a3);

  // ---- toggles / inputs ----
  await ev(`(()=>{const e=document.getElementById('t-quoteOn');e.click()})()`);
  const noq = await ev(`(()=>{const {d}=dress();return near(d,${W},232,185,49,10,0,0,${W},${t.cream.miny - 2}).n})()`);
  check('quote checkbox off hides the quote line', noq === 0 && (await ev('GODPOSTER.state.texts.toggles.quote')) === false, `gold px above title: ${noq}`);
  await ev(`document.getElementById('t-quoteOn').click()`);
  // typing into an input re-renders (spy on stage pixels)
  const before = await ev(`document.getElementById('stage').toDataURL().length`);
  await send('Runtime.evaluate', { expression: `(()=>{const i=document.getElementById('t-title');i.focus();i.select();})()` });
  await send('Input.insertText', { text: 'VICE CITY NIGHTS' });
  const typed = await ev(`GODPOSTER.state.texts.title`);
  const after = await ev(`document.getElementById('stage').toDataURL().length`);
  check('typing in Title input updates state and re-renders', typed === 'VICE CITY NIGHTS' && before !== after, typed);
  await ev(`(()=>{const i=document.getElementById('t-title');i.value='PALM HEAT';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  const longFit = await ev(`(()=>{GODPOSTER.state.texts.title='THE EXTREMELY LONG TITLE OF A VERY BIG CRIME FAMILY';const {d}=dress();const r=near(d,${W},255,94,58,12);GODPOSTER.state.texts.title='PALM HEAT';return r})()`);
  check('long title auto-shrinks to fit 92% of W', longFit.n > 0 && longFit.maxx - longFit.minx <= .92 * W, `fill width ${longFit.maxx - longFit.minx}`);

  // ---- ui:false parity (dressing identical; only selection outline differs on full render) ----
  const parity = await ev(`(()=>{const mk=(ui)=>{const c=document.createElement('canvas');c.width=${W};c.height=${H};const x=c.getContext('2d',{willReadFrequently:true});GODPOSTER.render(x,${W},${H},{ui});return x.getImageData(${W * .6 | 0},${H - 120},${W * .4 | 0},120).data};
    const a=mk(true),b=mk(false);let diff=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff++;
    const m=(ui)=>{const c=document.createElement('canvas');c.width=${W};c.height=${H};const x=c.getContext('2d',{willReadFrequently:true});GODPOSTER.render(x,${W},${H},{ui});return x.getImageData(${W * .6 | 0},0,${W * .4 | 0},${H}).data};
    const p=m(true),q=m(false);let d2=0;for(let i=0;i<p.length;i++)if(p[i]!==q[i])d2++;return {diffStrip:diff,diffRightPanels:d2}})()`);
  check('{ui:false}: dressing strip identical to ui:true', parity.diffStrip === 0, `differing bytes in bottom-right 120px (outside the selected hero panel): ${parity.diffStrip}`);

  // ---- layouts with a reserved title rectangle ----
  for (const [lay, size] of [['hero-band', 'landscape'], ['title-band', 'portrait'], ['hero-band', 'square']]) {
    await ev(`GODPOSTER.setSize('${size}'); GODPOSTER.setLayout('${lay}'); document.getElementById('spread').click();`);
    const info = await ev(`(()=>{const s=GODPOSTER.state,r=s.titleRect,W=s.size.w,H=s.size.h;const {d}=dress();
      const red=near(d,W,255,94,58,12),cr=near(d,W,255,243,214,10,0,r.y,W,r.y+r.h);const pk=near(d,W,255,79,163,14);
      return {r,W,H,red,cr,pk}})()`);
    const { r, red, cr, pk } = info;
    check(`${lay} ${size}: title+subtitle inside reserved rect`, red.n > 100 && cr.miny >= r.y && red.maxy + 4 <= r.y + r.h && pk.maxy <= r.y + r.h + 2 && cr.minx >= r.x, `rect y ${r.y}..${r.y + r.h}, title y ${cr.miny}..${red.maxy}, subtitle max y ${pk.maxy}`);
  }
  // ---- no stray console errors ----
  check('no page exceptions', errs.length === 0, errs.join(' | '));

  // ---- screenshots of the stage ----
  for (const [lay, size, name] of [['hero-left', 'landscape', 'hero-left-1920x1080'], ['hero-band', 'landscape', 'hero-band-1920x1080'], ['title-band', 'portrait', 'title-band-1080x1350'], ['grid-6', 'square', 'grid6-1080x1080']]) {
    await ev(`GODPOSTER.setSize('${size}'); GODPOSTER.setLayout('${lay}'); document.getElementById('spread').click(); GODPOSTER.render(document.getElementById('stage').getContext('2d'),GODPOSTER.state.size.w,GODPOSTER.state.size.h,{ui:false})`);
    const url = await ev(`document.getElementById('stage').toDataURL('image/png')`);
    writeFileSync(join(out, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
  await ev(`GODPOSTER.setSize('landscape'); GODPOSTER.setLayout('hero-left'); document.getElementById('spread').click();`);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, 'app-ui.png'), Buffer.from(shot.result.data, 'base64'));
  ws.close();
}
try { await main(); } catch (e) { check('test run completed', false, String(e.stack || e)); }
console.log(results.join('\n') + `\n\n${results.length - fails}/${results.length} passed`);
chrome.kill(); srv.close(); process.exit(fails ? 1 : 0);
