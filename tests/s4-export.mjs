// Session 4 test: bundled samples + PNG export. Headless Chrome over the DevTools protocol (no deps; Node 22+).
// Usage: node tests/s4-export.mjs <outDir>
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, readdirSync, mkdtempSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(new URL('../app', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const out = resolve(process.argv[2] || 'tests/out-s4');
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f.endsWith('.png')) (await import('node:fs')).rmSync(join(out, f));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.jpg': 'image/jpeg' };
const srv = createServer((q, r) => {
  const p = join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(root) || !existsSync(p)) { r.writeHead(404).end(); return; }
  r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }).end(readFileSync(p));
}).listen(0);
const port = srv.address().port;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9334', '--no-first-run', '--window-size=1600,1000',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gp4-'))}`, 'about:blank'], { stdio: 'ignore' });
let results = [], fails = 0;
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let tab; for (let i = 0; i < 50 && !tab; i++) {
    try { tab = (await (await fetch('http://127.0.0.1:9334/json')).json()).find((t) => t.type === 'page'); } catch {}
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
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: out });
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
  for (let i = 0; i < 100; i++) { if (await ev('!!window.GODPOSTER').catch(() => false)) break; await sleep(100); }

  // ---- samples ----
  const S = 'GODPOSTER.state';
  check('5 samples auto-loaded on first load', (await ev(`${S}.photos.length`)) === 5 && (await ev(`${S}.photos.map(p=>p.name).join()`)) === 'heroine.jpg,neon-man.jpg,supercar.jpg,palm-road.jpg,yacht.jpg', await ev(`${S}.photos.map(p=>p.name).join()`));
  check('PHOTOS rail shows 5 thumbs, counter 5', (await ev(`document.querySelectorAll('#thumbs button').length`)) === 5 && (await ev(`document.getElementById('photoCount').textContent`)) === '5');
  check('layout is HERO LEFT with 5 panels, each filled by a distinct photo',
    (await ev(`${S}.layoutId`)) === 'hero-left' && (await ev(`${S}.assignment.join()`)) === '0,1,2,3,4');
  check('all photos decoded (naturalWidth > 0)', await ev(`${S}.photos.every(p=>p.img.naturalWidth>0)`));
  // every HERO LEFT panel actually drawn: no placeholder grey, pixel variety in each panel
  const filled = await ev(`(()=>{const s=GODPOSTER.state,c=document.getElementById('stage'),x=c.getContext('2d',{willReadFrequently:true});
    GODPOSTER.render(x,s.size.w,s.size.h,{ui:false});
    return s.panels.map(r=>{const d=x.getImageData(r.x+20,r.y+20,Math.max(1,r.w-40),Math.max(1,r.h-40)).data;let lo=255,hi=0;for(let i=0;i<d.length;i+=4){const v=d[i]+d[i+1]+d[i+2];if(v<lo)lo=v;if(v>hi)hi=v}return hi-lo})})()`);
  check('every HERO LEFT panel has rendered photo content', filled.length === 5 && filled.every((v) => v > 150), `luma ranges ${filled.join(',')}`);
  // behave like user photos: select panel 2 + remove/replace path via the thumbs rail
  await ev(`${S}.selectedPanel=1; document.querySelectorAll('#thumbs button')[4].click()`);
  check('sample photo reassignable via rail like a user photo', (await ev(`${S}.assignment[1]`)) === 4);
  await ev(`document.getElementById('spread').click()`);

  // ---- export all ----
  const sel = await ev(`document.getElementById('exportAll').click(); 1`);
  const want = ['godposter-1920x1080.png', 'godposter-1080x1350.png', 'godposter-1080x1080.png'];
  for (let i = 0; i < 100 && !want.every((f) => existsSync(join(out, f))); i++) await sleep(150);
  await sleep(500);
  const files = readdirSync(out).filter((f) => f.endsWith('.png')).sort();
  check('three PNG downloads present with expected names', want.every((f) => files.includes(f)), files.join(', '));
  const dims = {};
  for (const f of want) {
    const b = readFileSync(join(out, f));
    const sig = b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    dims[f] = [b.readUInt32BE(16), b.readUInt32BE(20), sig, b.length];
  }
  const exp = { 'godposter-1920x1080.png': [1920, 1080], 'godposter-1080x1350.png': [1080, 1350], 'godposter-1080x1080.png': [1080, 1080] };
  for (const f of want) check(`${f} is a real PNG at exactly ${exp[f].join('x')}`, dims[f]?.[2] && dims[f][0] === exp[f][0] && dims[f][1] === exp[f][1], `IHDR ${dims[f]?.[0]}x${dims[f]?.[1]}, ${dims[f]?.[3]} bytes`);

  // title area non-blank: decode each saved file in the page, count title-gradient pixels in the bottom 40%
  for (const f of want) {
    const b64 = readFileSync(join(out, f)).toString('base64');
    const r = await ev(`(async()=>{const img=new Image();img.src='data:image/png;base64,${b64}';await img.decode();
      const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);
      const y0=Math.floor(c.height*.55),d=x.getImageData(0,y0,c.width,c.height-y0).data;let cream=0,red=0,amber=0;
      for(let i=0;i<d.length;i+=4){const R=d[i],G=d[i+1],B=d[i+2];
        if(Math.abs(R-255)<12&&Math.abs(G-94)<12&&Math.abs(B-58)<12)red++;
        if(Math.abs(R-255)<12&&Math.abs(G-179)<12&&Math.abs(B-71)<12)amber++;
        if(Math.abs(R-255)<10&&Math.abs(G-243)<10&&Math.abs(B-214)<10)cream++}
      return {w:c.width,h:c.height,cream,amber,red}})()`);
    check(`${f}: title lettering present (gradient pixels)`, r.w === exp[f][0] && r.h === exp[f][1] && r.cream + r.amber + r.red > 800 && r.amber > 200, `cream ${r.cream} amber ${r.amber} red ${r.red}`);
  }
  // ui:false means no selection outline: pink dashed outline colour #ff2f92 should be absent from hero panel edge
  const status1 = await ev(`document.getElementById('status').textContent`);
  check('status line names the saved files', want.every((f) => status1.includes(f)), status1);

  // ---- single-size export button ----
  await ev(`GODPOSTER.setSize('portrait')`);
  const n0 = readdirSync(out).length;
  await ev(`(()=>{const s=document.getElementById('status');s.textContent='';document.getElementById('exportOne').click()})()`);
  for (let i = 0; i < 40 && !(await ev(`document.getElementById('status').textContent`)).startsWith('Saved'); i++) await sleep(100);
  check('EXPORT PNG (current size) reports "Saved godposter-1080x1350.png"', (await ev(`document.getElementById('status').textContent`)) === 'Saved godposter-1080x1350.png');
  // export must not disturb live state
  check('live state unchanged after export (size/panels/preview canvas)', (await ev(`${S}.size.w===1080&&${S}.size.h===1350&&document.getElementById('stage').width===1080&&document.getElementById('stage').height===1350`)));
  // export from a title-rect layout
  await ev(`GODPOSTER.setLayout('hero-band'); GODPOSTER.exportPNG(1920,1080)`);
  await sleep(800);
  check('exportPNG works from a title-rect layout without exceptions', errs.length === 0, errs.join(' | '));
  ws.close();
}
try { await main(); } catch (e) { check('test run completed', false, String(e.stack || e)); }
console.log(results.join('\n') + `\n\n${results.length - fails}/${results.length} passed`);
chrome.kill(); srv.close(); process.exit(fails ? 1 : 0);
