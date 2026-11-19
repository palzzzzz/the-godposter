// Session 5 test: family seal, wanted pill, chips, starring, SHUFFLE CHIP, MAKE ME AN OFFER.
// Headless Chrome over the DevTools protocol (no deps; Node 22+). Usage: node tests/s5-signature.mjs [outDir]
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(new URL('../app', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const out = resolve(process.argv[2] || 'tests/out-s5');
mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.jpg': 'image/jpeg' };
const srv = createServer((q, r) => {
  const p = join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(root) || !existsSync(p)) { r.writeHead(404).end(); return; }
  r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }).end(readFileSync(p));
}).listen(0);
const port = srv.address().port;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9335', '--no-first-run', '--window-size=1600,1000',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gp5-'))}`, 'about:blank'], { stdio: 'ignore' });
let results = [], fails = 0;
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let tab; for (let i = 0; i < 50 && !tab; i++) {
    try { tab = (await (await fetch('http://127.0.0.1:9335/json')).json()).find((t) => t.type === 'page'); } catch {}
    if (!tab) await sleep(200);
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
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
  for (let i = 0; i < 100; i++) { if (await ev('!!window.GODPOSTER').catch(() => false)) break; await sleep(100); }

  // helpers in page: dressing-only render on a transparent canvas; count colour-matching opaque pixels in a box
  await ev(`window.dress=()=>{const W=GODPOSTER.state.size.w,H=GODPOSTER.state.size.h,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});GODPOSTER.renderDressing(x,W,H);return {W,H,d:x.getImageData(0,0,W,H)}};
  window.near=(o,r,g,b,tol,x0,y0,x1,y1)=>{const {W,d}=o;let n=0,minx=1e9,maxx=-1,miny=1e9,maxy=-1;x0=Math.max(0,x0|0);y0=Math.max(0,y0|0);x1=Math.min(W,x1|0);y1=Math.min(d.height,y1|0);
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*W+x)*4;if(d.data[i+3]<250)continue;if(Math.abs(d.data[i]-r)<=tol&&Math.abs(d.data[i+1]-g)<=tol&&Math.abs(d.data[i+2]-b)<=tol){n++;if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y}}return {n,minx,maxx,miny,maxy}};
  window.alpha=(o,x0,y0,x1,y1)=>{const {W,d}=o;let n=0;for(let y=y0|0;y<(y1|0);y++)for(let x=x0|0;x<(x1|0);x++)if(d.data[((y*W)+x)*4+3]>128)n++;return n}`);
  await ev(`GODPOSTER.setLayout('hero-left'); GODPOSTER.setSize('landscape'); document.getElementById('spread').click()`);
  const W = 1920, H = 1080, R = .055 * W, sx = .9 * W, sy = .13 * H;

  // ---- state shape ----
  const shape = await ev(`(()=>{const d=GODPOSTER.state.dressing;return {seal:d.seal,wanted:d.wanted,n:d.chips.length,c0:d.chips[0],c5:d.chips[5]}})()`);
  check('state.dressing defaults', shape.seal.on && shape.seal.line1 === 'FAMILY' && shape.seal.line2 === 'SEAL' && shape.wanted.on && shape.n >= 5 && shape.c0.place === 'NEON MILE' && shape.c5.starring === 'THE PRIEST', JSON.stringify(shape.c0));

  // ---- family seal ----
  const seal = await ev(`(()=>{const o=dress();const m=near(o,224,24,154,6,${sx - R - 4},${sy - R - 4},${sx + R + 4},${sy + R + 4});const g=near(o,232,185,49,10,${sx - R - 4},${sy - R - 4},${sx + R + 4},${sy + R + 4});const cr=near(o,255,243,214,10,${sx - R},${sy - R * .3},${sx + R},${sy + R});return {m,g,cr}})()`);
  check('seal magenta burst present at corner', seal.m.n > 3000 && Math.abs((seal.m.minx + seal.m.maxx) / 2 - sx) < 10 && Math.abs((seal.m.miny + seal.m.maxy) / 2 - sy) < 10, `n=${seal.m.n} bbox x${seal.m.minx}..${seal.m.maxx} y${seal.m.miny}..${seal.m.maxy}`);
  check('seal radius ≈ 0.055W', Math.abs((seal.m.maxx - seal.m.minx) / 2 - R) < R * .1, `half-width ${(seal.m.maxx - seal.m.minx) / 2} vs ${R.toFixed(1)}`);
  check('seal gold ring + stars present', seal.g.n > 400, `gold ${seal.g.n}`);
  check('seal Anton cream text present', seal.cr.n > 300, `cream ${seal.cr.n}`);
  // hero text wording differs
  await ev(`document.getElementById('d-seal').click()`);
  const sealOff = await ev(`(()=>{const o=dress();return near(o,224,24,154,6,${sx - R - 4},${sy - R - 4},${sx + R + 4},${sy + R + 4}).n})()`);
  check('seal gone when unticked', sealOff === 0 && (await ev('GODPOSTER.state.dressing.seal.on')) === false, `magenta px ${sealOff}`);
  await ev(`document.getElementById('d-seal').click()`);
  // nudged inside frame on portrait
  await ev(`GODPOSTER.setSize('portrait')`);
  const pm = await ev(`(()=>{const o=dress();return {W:o.W,m:near(o,224,24,154,6,0,0,o.W,o.H)}})()`);
  check('seal stays inside frame (portrait)', pm.m.maxx <= pm.W && pm.m.minx > 0 && pm.m.miny > 0 && pm.m.n > 2000, `x${pm.m.minx}..${pm.m.maxx} y${pm.m.miny}..${pm.m.maxy}`);
  await ev(`GODPOSTER.setSize('landscape')`);

  // ---- wanted pill ----
  const wp = await ev(`(()=>{const o=dress();const x0=${W * .6},y1=${H * .12};return {black:near(o,0,0,0,0,x0,0,${W},y1),cream:near(o,255,243,214,10,x0,0,${W},y1),gold:near(o,232,185,49,10,x0,0,${sx - R - 6},y1)}})()`);
  check('wanted pill: black body + cream WANTED + gold stars in top-right', wp.black.n > 3000 && wp.cream.n > 150 && wp.gold.n > 80 && wp.black.maxx <= W && wp.black.miny < H * .08, `black ${wp.black.n} x${wp.black.minx}..${wp.black.maxx} y${wp.black.miny}..${wp.black.maxy}; cream ${wp.cream.n}; gold ${wp.gold.n}`);
  await ev(`document.getElementById('d-wanted').click()`);
  const wOff = await ev(`(()=>{const o=dress();return near(o,0,0,0,0,${W * .6},0,${sx - R - 4},${H * .1}).n})()`);
  check('wanted pill gone when unticked', wOff === 0, `black px ${wOff}`);
  await ev(`document.getElementById('d-wanted').click()`);

  // ---- chips + starring on every filled panel ----
  const panels = await ev(`GODPOSTER.state.panels.map(p=>({...p}))`);
  const filled = await ev(`GODPOSTER.state.dressing.chips.slice(0,GODPOSTER.state.panels.length).map(c=>c.place&&c.starring?1:0)`);
  const inset = .008 * W, gut = Math.max(3, Math.round(W / 320));
  const chipRes = await ev(`(()=>{const o=dress();return GODPOSTER.state.panels.map((p,i)=>{
      const ch=GODPOSTER.state.dressing.chips[i];
      const bx=p.x+${inset + gut},by=p.y+p.h*.5,bx1=p.x+p.w,by1=p.y+p.h-4;
      const bar=near(o,255,47,146,6,bx,by,bx1,by1);const white=near(o,255,255,255,4,bx,by,bx1,by1);const gold=near(o,232,185,49,10,bx,by,bx1,by1);
      const sGold=near(o,232,185,49,10,p.x+${inset + gut},p.y,p.x+p.w,p.y+p.h*.25);
      return {i,place:ch.place,bar:bar.n,white:white.n,gold:gold.n,sGold:sGold.n,sx:sGold.minx-p.x}})})()`);
  chipRes.forEach((r, i) => {
    if (!filled[i]) return;
    check(`panel ${i + 1} chip (pink bar, white place, gold time/mood) renders`, r.bar > 20 && r.white > 80 && r.gold > 40, `${r.place}: bar ${r.bar} white ${r.white} gold ${r.gold}`);
    check(`panel ${i + 1} STARRING text (gold, top-left) renders`, r.sGold > 150 && r.sx < W * .03, `gold ${r.sGold} minx offset ${r.sx}`);
  });
  check('every panel of HERO LEFT has chip+starring defaults', filled.length === 5 && filled.every(Boolean), `filled=${filled}`);
  // skipping rules
  await ev(`GODPOSTER.state.dressing.chips[1].place='';GODPOSTER.state.dressing.chips[1].starring=''`);
  const skip = await ev(`(()=>{const o=dress();const p=GODPOSTER.state.panels[1];return near(o,255,47,146,6,p.x+${inset + gut},p.y+p.h*.5,p.x+p.w,p.y+p.h).n+near(o,232,185,49,10,p.x+${inset + gut},p.y,p.x+p.w*.3,p.y+p.h*.25).n})()`);
  check('empty place/starring skip chip and starring', skip === 0, `pixels ${skip}`);
  await ev(`GODPOSTER.state.dressing.chips[1].place='PORT LEONIDA';GODPOSTER.state.dressing.chips[1].starring='LA SIRENA'`);

  // ---- DRESSING inputs for the selected panel ----
  await ev(`GODPOSTER.state.selectedPanel=2; document.querySelector('.chip[data-i="2"]').click()`);
  const sel = await ev(`['place','time','mood','starring'].map(k=>document.getElementById('c-'+k).value).join('|')`);
  check('inputs show the selected panel chip', sel === 'VICE BEACH|8:03 PM|LAST SWIM|THE DRIVER', sel);
  const before = await ev(`document.getElementById('stage').toDataURL().length`);
  await send('Runtime.evaluate', { expression: `(()=>{const i=document.getElementById('c-place');i.focus();i.select()})()` });
  await send('Input.insertText', { text: 'CASINO ROW' });
  const after = await ev(`document.getElementById('stage').toDataURL().length`);
  check('typing Place updates state + re-renders', (await ev(`GODPOSTER.state.dressing.chips[2].place`)) === 'CASINO ROW' && before !== after);

  // ---- SHUFFLE CHIP ----
  const s0 = await ev(`JSON.stringify(GODPOSTER.state.dressing.chips[2])`);
  const px0 = await ev(`document.getElementById('stage').toDataURL().length`);
  await ev(`document.getElementById('shuffleChip').click()`);
  const s1 = await ev(`JSON.stringify(GODPOSTER.state.dressing.chips[2])`);
  const o0 = JSON.parse(s0), o1 = JSON.parse(s1);
  check('SHUFFLE CHIP changes all four fields of selected panel', ['place', 'time', 'mood', 'starring'].every((k) => o0[k] !== o1[k] && o1[k]), `${s0} -> ${s1}`);
  check('shuffle re-renders canvas and syncs inputs', (await ev(`document.getElementById('stage').toDataURL().length`)) !== px0 && (await ev(`document.getElementById('c-place').value`)) === o1.place);
  check('other panels untouched by shuffle', (await ev(`GODPOSTER.state.dressing.chips[0].place`)) === 'NEON MILE');
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, 'app-ui.png'), Buffer.from(shot.result.data, 'base64'));

  // ---- MAKE ME AN OFFER ----
  let changedLayout = 0, changedGrade = 0, changedChip = 0, titles = new Set();
  for (let n = 0; n < 6; n++) {
    const a = await ev(`JSON.stringify({l:GODPOSTER.state.layoutId,g:{...GODPOSTER.state.grade},c:GODPOSTER.state.dressing.chips.map(c=>({...c}))})`);
    await ev(`document.getElementById('offer').click()`);
    const b = await ev(`JSON.stringify({l:GODPOSTER.state.layoutId,g:{...GODPOSTER.state.grade},c:GODPOSTER.state.dressing.chips.map(c=>({...c})),t:GODPOSTER.state.texts.title+'/'+GODPOSTER.state.texts.subtitle,np:GODPOSTER.state.panels.length})`);
    const A = JSON.parse(a), B = JSON.parse(b);
    if (A.l !== B.l) changedLayout++;
    if (A.g.id !== B.g.id) changedGrade++;
    if (B.c.slice(0, B.np).some((c, i) => A.c[i] && c.place !== A.c[i].place)) changedChip++;
    titles.add(B.t);
    check(`offer #${n + 1}: every panel has a full chip, grade matches preset`, B.c.slice(0, B.np).every((c) => c.place && c.time && c.mood && c.starring) && (await ev(`(()=>{const g=GODPOSTER.state.grade,G=GODPOSTER.GRADES.find(x=>x.id===g.id);return G.d.join()===[g.strength,g.contrast,g.saturation,g.grain,g.vignette].join()})()`)), `${B.l} ${B.g.id} "${B.t}"`);
  }
  check('MAKE ME AN OFFER changes layout every time', changedLayout === 6, `${changedLayout}/6`);
  check('MAKE ME AN OFFER changes grade every time', changedGrade === 6, `${changedGrade}/6`);
  check('MAKE ME AN OFFER changes chips', changedChip >= 5, `${changedChip}/6`);
  check('offer picks title/subtitle pairs (varied)', titles.size >= 2, [...titles].join(' ; '));
  const pairs = await ev(`(()=>{const t=document.getElementById('t-title').value+'/'+document.getElementById('t-subtitle').value;return t===GODPOSTER.state.texts.title+'/'+GODPOSTER.state.texts.subtitle})()`);
  check('title inputs sync after offer', pairs);
  check('no page exceptions', errs.length === 0, errs.join(' | '));

  // ---- screenshots ----
  await ev(`GODPOSTER.setLayout('hero-left'); GODPOSTER.setSize('landscape'); document.getElementById('spread').click()`);
  await ev(`(()=>{const d=GODPOSTER.state.dressing;GODPOSTER.state.texts.title='PALM HEAT';GODPOSTER.state.texts.subtitle='Loyalty is everything';d.chips.forEach((c,i)=>Object.assign(c,{place:['NEON MILE','PORT LEONIDA','VICE BEACH','KALAGA STRIP','THE DOCKS','PALM HEIGHTS'][i]||'',time:['6:42 PM','7:15 PM','8:03 PM','9:26 PM','5:58 PM','11:11 PM'][i]||'',mood:['NO WITNESSES','EASY MONEY','LAST SWIM','FULL THROTTLE','QUIET BUSINESS','LOUD NIGHT'][i]||'',starring:['THE GHOST','LA SIRENA','THE DRIVER','THE ACCOUNTANT','THE VIPER','THE PRIEST'][i]||''}))})()`);
  for (const [lay, size, name] of [['hero-left', 'landscape', 'hero-left'], ['grid-9', 'square', 'grid9'], ['title-band', 'portrait', 'title-band'], ['hero-band', 'landscape', 'hero-band']]) {
    await ev(`GODPOSTER.setSize('${size}'); GODPOSTER.setLayout('${lay}'); document.getElementById('spread').click(); GODPOSTER.render(document.getElementById('stage').getContext('2d'),GODPOSTER.state.size.w,GODPOSTER.state.size.h,{ui:false})`);
    writeFileSync(join(out, name + '.png'), Buffer.from((await ev(`document.getElementById('stage').toDataURL('image/png')`)).split(',')[1], 'base64'));
  }
  ws.close();
}
try { await main(); } catch (e) { check('test run completed', false, String(e.stack || e)); }
console.log(results.join('\n') + `\n\n${results.length - fails}/${results.length} passed`);
chrome.kill(); srv.close(); process.exit(fails ? 1 : 0);
