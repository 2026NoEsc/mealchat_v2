/** Chrome/CDP evidence, following uiV3.browser.cjs. No production backend access. */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const output = path.resolve('tmp/auth-a-render');
fs.mkdirSync(output, { recursive: true });
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style></head><body><div id="root"></div><script src="http://localhost:8096/scripts/ui-preview/authA.preview.bundle?platform=web&dev=false&minify=false"></script></body></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get(`http://localhost:8096${request.url}`, (asset) => {
    response.writeHead(asset.statusCode, asset.headers); asset.pipe(response);
  }).on('error', () => { response.writeHead(502); response.end(); });
});
let browser;
let socket;
let call;
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 200; attempt++) { if (await evaluate(expression)) return; await delay(100); }
  throw new Error(`Browser condition timed out: ${expression}`);
}
async function main() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-auth-a-chrome-'));
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--force-device-scale-factor=2',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  const activePort = path.join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100 && !fs.existsSync(activePort); attempt++) await delay(100);
  const port = fs.readFileSync(activePort, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const pending = new Map();
  let sequence = 0;
  socket.onmessage = (event) => {
    const result = JSON.parse(event.data);
    if (!result.id) return;
    const task = pending.get(result.id); pending.delete(result.id);
    if (result.error) task.reject(new Error(result.error.message)); else task.resolve(result.result);
  };
  call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  await call('Page.enable');
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const evidence = [];
  const scenes = ['start', 'login', 'login-large-labels', 'reset', 'reset-sent', 'new-password', 'personal', 'personal-large-labels', 'personal-taken', 'personal-bank', 'terms', 'reconsent', 'loading'];
  for (const width of [412, 375]) {
    for (const scene of scenes) {
      const height = width === 412 ? 892 : 812;
      await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
      await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?scene=${scene}` });
      await waitFor('document.body.innerText.trim().length > 0');
      await evaluate('document.fonts.ready.then(() => true)');
      await waitFor('[...document.images].every(image => image.complete && image.naturalWidth > 0)');
      if (scene.endsWith('large-labels')) {
        await evaluate(`document.querySelectorAll('[id$="-label"]').forEach(label => { label.style.fontSize = '26px'; label.style.lineHeight = '40px'; })`);
        await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        const alignment = await evaluate(`(() => {
          const password = document.querySelector('input[aria-label="비밀번호"]');
          const toggle = document.querySelector('[aria-label="비밀번호 보기"]');
          const email = document.querySelector('input[aria-label="이메일"]');
          const check = document.querySelector('[aria-label="중복 확인"]');
          if (toggle) { const input = password.getBoundingClientRect(), button = toggle.getBoundingClientRect();
            return { difference: Math.abs(input.y + input.height / 2 - button.y - button.height / 2) }; }
          return { difference: Math.abs(email.getBoundingClientRect().y - check.getBoundingClientRect().y) };
        })()`);
        assert.ok(alignment.difference <= 0.1, `${scene}: scaled label misaligned controls`);
      }
      if (scene === 'reset' || scene === 'new-password') {
        await evaluate(`(() => { const input = document.querySelector('input[aria-label="${scene === 'reset' ? '이메일' : '새 비밀번호'}"]'); input.blur(); input.focus(); })()`);
      }
      if (scene === 'reset-sent') {
        await evaluate(`document.querySelector('[aria-label="재설정 메일 보내기"]').click()`);
        await waitFor('document.body.innerText.includes("메일을 보냈어요.")');
      }
      if (scene === 'personal-taken') {
        await evaluate(`document.querySelector('input[aria-label="이메일"]').focus()`);
        await call('Input.insertText', { text: 'mealchat@example.test' });
        await evaluate(`document.querySelector('[aria-label="중복 확인"]').click()`);
        await waitFor(`document.body.innerText.includes('이미 가입된 이메일이에요.')`);
        assert.equal(await evaluate(`document.querySelector('input[aria-label="이메일"]').getAttribute('aria-invalid')`), 'true');
      }
      if (scene === 'personal-bank') {
        await evaluate(`document.querySelector('[aria-label="은행 선택"]').click()`);
        await waitFor(`document.body.innerText.includes('은행·증권사 선택')`);
        await evaluate(`document.querySelector('input[aria-label="은행·증권사 검색"]').focus()`);
        await call('Input.insertText', { text: '증권' });
        await waitFor(`!!document.querySelector('[aria-label="미래에셋증권"]')`);
        assert.equal(await evaluate(`document.querySelector('[aria-label="국민은행"]') === null`), true);
      }
      if (scene === 'login') {
        assert.equal(await evaluate(`document.querySelector('input[aria-label="비밀번호"]').type`), 'password');
        await evaluate(`document.querySelector('[aria-label="비밀번호 보기"]').click()`);
        await waitFor(`document.querySelector('input[aria-label="비밀번호"]').type === 'text'`);
        await evaluate(`document.querySelector('[aria-label="비밀번호 숨기기"]').click()`);
      }
      // Modal's fade must finish; otherwise a capture can falsely show a translucent sheet.
      await evaluate('Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined))).then(() => true)');
      const metrics = await evaluate(`(() => {
        const rect = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const visible = (e) => e.getClientRects().length > 0 && !e.closest('[aria-hidden="true"]');
        return { viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
          buttons: [...document.querySelectorAll('[role="button"],[role="checkbox"]')].filter(visible).map(e => ({ label: e.getAttribute('aria-label') || e.innerText, ...rect(e) })),
          inputs: [...document.querySelectorAll('input')].filter(visible).map(e => ({ label: e.getAttribute('aria-label'), fontSize: getComputedStyle(e).fontSize, ...rect(e) })),
          text: document.body.innerText,
        };
      })()`);
      assert.equal(metrics.overflow, false, `${scene}: horizontal overflow`);
      if (scene === 'terms') {
        assert.ok(metrics.text.includes('거의 다 왔어요!'));
        assert.ok(metrics.text.includes('두두가 여러분의 의견을 모아서 두두두 전해 줄게요.'));
        assert.equal(metrics.text.includes('건강 관련 정보'), false);
      }
      for (const button of metrics.buttons) assert.ok(button.width >= 44 && button.height >= 44, `${scene}: small target ${button.label}`);
      for (const input of metrics.inputs) assert.ok(input.height >= 52 && parseFloat(input.fontSize) >= 16, `${scene}: input ${input.label}`);
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      const capture = await call('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 0.5 } });
      const screenshot = `${scene}-${width}x${height}.png`;
      fs.writeFileSync(path.join(output, screenshot), Buffer.from(capture.data, 'base64'));
      evidence.push({ scene, width, height, screenshot, metrics });
    }
  }
  fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify(evidence, null, 2));
  process.stdout.write(`Auth A render checks passed. Evidence: ${output}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }).finally(() => {
  socket?.close(); browser?.kill(); server.close();
});
