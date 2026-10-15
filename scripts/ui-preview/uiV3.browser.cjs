/**
 * Manual render evidence. From the repository root, run the dotenv-free preview
 * Metro command documented in uiV3.preview.tsx, then:
 * node scripts/ui-preview/uiV3.browser.cjs
 * Requires local Chrome (or CHROME_PATH) and Node with built-in WebSocket support.
 */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'mealchat-ui-v3-render-'));
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex}</style></head><body><div id="root"></div><script src="http://localhost:8095/scripts/ui-preview/uiV3.preview.bundle?platform=web&dev=false&minify=false"></script></body></html>';
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/') return response.end(html);
  http.get(`http://localhost:8095${request.url}`, (asset) => {
    response.writeHead(asset.statusCode, asset.headers);
    asset.pipe(response);
  }).on('error', () => { response.writeHead(502); response.end(); });
});
let browser;
let socket;
let call;

async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}

async function main() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  browser = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--force-device-scale-factor=2',
    '--remote-debugging-port=0', `--user-data-dir=${path.join(output, 'profile')}`, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  const activePort = path.join(output, 'profile', 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100 && !fs.existsSync(activePort); attempt++) await delay(100);
  const port = fs.readFileSync(activePort, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const result = JSON.parse(event.data);
    if (!result.id) return;
    const task = pending.get(result.id);
    pending.delete(result.id);
    if (result.error) task.reject(new Error(result.error.message));
    else task.resolve(result.result);
  };
  call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await call('Page.enable');
  const cases = [
    { width: 412, height: 892, states: false },
    { width: 375, height: 812, states: false },
    { width: 412, height: 892, states: true },
    { width: 892, height: 412, states: false },
  ];
  const evidence = [];
  for (const test of cases) {
    await call('Emulation.setDeviceMetricsOverride', { width: test.width, height: test.height, deviceScaleFactor: 2, mobile: true });
    await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?states=${test.states ? 1 : 0}` });
    await waitFor(`document.body.innerText.includes(${JSON.stringify(test.states ? '입력 · 버튼 상태' : '공용 컴포넌트')})`);
    await evaluate('document.fonts.ready.then(() => true)');
    assert.equal(await evaluate('document.fonts.check("16px Dot42Sans-Regular")'), true);
    await waitFor('[...document.images].every(image => image.complete && image.naturalWidth > 0)');
    const metrics = await evaluate(`(() => {
      const rect = (element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      const measured = (element) => {
        const style = getComputedStyle(element);
        return { ...rect(element), radius: parseFloat(style.borderTopLeftRadius), border: parseFloat(style.borderTopWidth),
          paddingLeft: parseFloat(style.paddingLeft), paddingRight: parseFloat(style.paddingRight),
          paddingTop: parseFloat(style.paddingTop), paddingBottom: parseFloat(style.paddingBottom),
          gap: parseFloat(style.gap), fontSize: parseFloat(style.fontSize), fontFamily: style.fontFamily,
          color: style.color, background: style.backgroundColor, borderColor: style.borderTopColor,
          outlineWidth: parseFloat(style.outlineWidth) };
      };
      const brand = document.querySelector('[aria-label="MealChat"]');
      const bell = document.querySelector('[aria-label="알림, 읽지 않은 알림 있음"]');
      const tab = document.querySelector('[role="tab"]');
      const input = document.querySelector('input');
      const row = document.querySelector('[aria-label="닉네임, 밀챗"]');
      const radio = document.querySelector('[role="radio"]');
      const checkbox = document.querySelector('[role="checkbox"][aria-label="알림 받기"]');
      const fieldTexts = [...input.parentElement.children].filter(e => e !== input);
      return {
        viewport: window.innerWidth,
        devicePixelRatio: window.devicePixelRatio,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        buttons: [...document.querySelectorAll('[role="button"]')].map(e => ({ label: e.innerText || e.getAttribute('aria-label'), disabled: e.getAttribute('aria-disabled'), ...rect(e) })),
        inputs: [...document.querySelectorAll('input')].map(e => ({ fontSize: getComputedStyle(e).fontSize, ...rect(e) })),
        tabs: [...document.querySelectorAll('[role="tab"]')].map(e => ({ selected: e.getAttribute('aria-selected'), ...rect(e) })),
        switches: [...document.querySelectorAll('[role="switch"]')].map(rect),
        geometry: {
          header: measured(brand.parentElement), logo: measured(brand.firstElementChild),
          wordmark: measured(brand.lastElementChild), brandGap: measured(brand).gap,
          bellIcon: measured(bell.querySelector('svg')), unreadDot: measured(bell.firstElementChild.lastElementChild),
          nav: measured(tab.parentElement), tabs: [...document.querySelectorAll('[role="tab"]')].map(measured),
          navDivider: measured(tab.parentElement.firstElementChild),
          tabLabels: [...document.querySelectorAll('[role="tab"]')].map(e => measured(e.querySelector('[dir="auto"]'))),
          tabIconSlots: [...document.querySelectorAll('[role="tab"]')].map(e => measured(e.firstElementChild)),
          tabIcons: [...document.querySelectorAll('[role="tab"] svg')].map(e => ({
            ...rect(e), fill: e.getAttribute('fill'), stroke: getComputedStyle(e).stroke, strokeWidth: Number(e.getAttribute('stroke-width')),
          })),
          tabChildCounts: [...document.querySelectorAll('[role="tab"]')].map(e => e.children.length),
          primary: measured([...document.querySelectorAll('[role="button"]')].find(e => e.innerText === '주 버튼')),
          input: measured(input), label: measured(fieldTexts[0]), helper: fieldTexts[1] ? {
            ...measured(fieldTexts[1]), text: fieldTexts[1].innerText, label: fieldTexts[1].getAttribute('aria-label'),
          } : null,
          labelGap: input.getBoundingClientRect().top - fieldTexts[0].getBoundingClientRect().bottom,
          helperGap: fieldTexts[1] ? fieldTexts[1].getBoundingClientRect().top - input.getBoundingClientRect().bottom : null,
          chips: [...document.querySelectorAll('[role="checkbox"]')].filter(e => ['한식', '양식'].includes(e.getAttribute('aria-label'))).map(e => ({
            ...measured(e), selected: e.getAttribute('aria-checked') === 'true', label: measured(e.lastElementChild),
            icon: e.querySelector('svg') ? rect(e.querySelector('svg')) : null,
          })),
          radio: radio ? { row: measured(radio), circle: measured(radio.firstElementChild.firstElementChild),
            innerChildren: radio.firstElementChild.firstElementChild.children.length, label: measured(radio.lastElementChild) } : null,
          checkbox: checkbox ? { target: measured(checkbox.firstElementChild), box: measured(checkbox.firstElementChild.firstElementChild) } : null,
          list: row ? { row: measured(row), title: measured(row.firstElementChild), arrow: measured(row.lastElementChild) } : null,
        },
      };
    })()`);
    assert.equal(metrics.viewport, test.width);
    assert.equal(metrics.overflow, false);
    assert.ok(metrics.buttons.every((button) => button.height >= 44 && button.x + button.width <= test.width + 0.1));
    assert.ok(metrics.inputs.every((input) => Number.parseFloat(input.fontSize) >= 16 && input.height >= 52));
    assert.equal(metrics.tabs.length, 3);
    assert.ok(metrics.tabs.every((tab) => tab.height === 52));
    assert.deepEqual(metrics.tabs.map((tab) => tab.selected), ['true', 'false', 'false']);
    assert.ok(metrics.switches.every((toggle) => toggle.width === 56 && toggle.height === 44));
    const geometry = metrics.geometry;
    fs.writeFileSync(path.join(output, 'current-metrics.json'), JSON.stringify(metrics, null, 2));
    assert.equal(geometry.primary.height, 52);
    assert.equal(geometry.primary.radius, 14);
    assert.equal(geometry.input.radius, 12);
    assert.equal(geometry.input.paddingLeft, 16);
    assert.equal(geometry.input.paddingRight, 16);
    assert.equal(geometry.input.background, 'rgb(255, 255, 255)');
    assert.equal(geometry.input.borderColor, test.states ? 'rgb(198, 40, 40)' : 'rgb(232, 227, 220)');
    assert.equal(geometry.input.border, test.states ? 2 : 1);
    assert.equal(geometry.label.color, 'rgb(107, 102, 95)');
    assert.equal(geometry.helper.color, test.states ? 'rgb(198, 40, 40)' : 'rgb(107, 102, 95)');
    assert.equal(geometry.helper.text.startsWith('오류:'), false);
    if (test.states) assert.equal(geometry.helper.label, `오류: ${geometry.helper.text}`);
    assert.equal(geometry.label.fontSize, 13);
    assert.ok(geometry.label.fontFamily.includes('Medium'));
    assert.equal(geometry.labelGap, 6);
    assert.equal(geometry.helper.fontSize, 13);
    assert.ok(geometry.helper.fontFamily.includes('Regular'));
    assert.equal(geometry.helperGap, 6);
    assert.equal(geometry.header.height, 60);
    assert.equal(geometry.header.background, 'rgb(248, 246, 242)');
    assert.equal(geometry.header.paddingLeft, 20);
    assert.equal(geometry.header.paddingRight, 8);
    assert.equal(geometry.logo.width, 32);
    assert.equal(geometry.logo.height, 32);
    assert.equal(geometry.logo.radius, 8);
    assert.equal(geometry.wordmark.width, 92);
    assert.equal(geometry.wordmark.height, 20);
    assert.equal(geometry.brandGap, 8);
    assert.equal(geometry.bellIcon.width, 24);
    assert.equal(geometry.bellIcon.height, 24);
    assert.equal(geometry.unreadDot.width, 8);
    assert.equal(geometry.unreadDot.height, 8);
    assert.equal(geometry.nav.height, 72);
    assert.equal(geometry.nav.background, 'rgb(255, 255, 255)');
    assert.equal(geometry.navDivider.height, 1);
    assert.equal(geometry.navDivider.background, 'rgb(232, 227, 220)');
    assert.equal(geometry.nav.paddingTop, 6);
    assert.equal(geometry.nav.paddingBottom, 14);
    assert.equal(geometry.nav.paddingLeft, 8);
    assert.equal(geometry.nav.paddingRight, 8);
    assert.ok(geometry.tabs.every((item) => item.gap === 2));
    assert.ok(geometry.tabIconSlots.every((item) => item.width === 24 && item.height === 24));
    assert.ok(geometry.tabLabels[0].fontFamily.includes('Bold'));
    assert.ok(geometry.tabLabels.slice(1).every((item) => item.fontFamily.includes('Medium')));
    assert.deepEqual(geometry.tabLabels.map((item) => item.color), ['rgb(138, 75, 0)', 'rgb(107, 102, 95)', 'rgb(107, 102, 95)']);
    assert.ok(geometry.tabs.every((item) => item.background === 'rgba(0, 0, 0, 0)'));
    assert.deepEqual(geometry.tabChildCounts, [2, 2, 2]);
    assert.equal(geometry.tabIcons.length, 3);
    assert.ok(geometry.tabIcons.every((icon) => icon.fill === 'none' && icon.strokeWidth === 2 && icon.width === 24 && icon.height === 24));
    assert.deepEqual(geometry.tabIcons.map((icon) => icon.stroke), ['rgb(138, 75, 0)', 'rgb(107, 102, 95)', 'rgb(107, 102, 95)']);
    for (const chip of geometry.chips) {
      assert.equal(chip.height, 44);
      assert.equal(chip.radius, 22);
      assert.equal(chip.paddingLeft, chip.selected ? 15.5 : 16);
      assert.equal(chip.paddingRight, chip.selected ? 15.5 : 16);
      assert.equal(chip.gap, 4);
      assert.equal(chip.border, chip.selected ? 1.5 : 1);
      assert.equal(chip.label.fontSize, 14);
      assert.ok(chip.label.fontFamily.includes(chip.selected ? 'Bold' : 'Regular'));
      if (chip.selected) assert.equal(chip.icon.width, 14);
    }
    if (geometry.radio) {
      assert.equal(geometry.radio.row.height, 44);
      assert.equal(geometry.radio.row.gap, 12);
      assert.equal(geometry.radio.circle.width, 20);
      assert.equal(geometry.radio.circle.height, 20);
      assert.equal(geometry.radio.circle.border, 6);
      assert.equal(geometry.radio.innerChildren, 0);
      assert.equal(geometry.radio.label.fontSize, 14);
      assert.ok(geometry.radio.label.fontFamily.includes('Bold'));
      assert.equal(geometry.checkbox.target.width, 44);
      assert.equal(geometry.checkbox.target.height, 44);
      assert.equal(geometry.checkbox.box.width, 22);
      assert.equal(geometry.checkbox.box.height, 22);
      assert.equal(geometry.checkbox.box.radius, 6);
      assert.equal(geometry.list.row.height, 56);
      assert.equal(geometry.list.row.paddingLeft, 16);
      assert.equal(geometry.list.row.paddingRight, 8);
      assert.equal(geometry.list.row.gap, 8);
      assert.equal(geometry.list.title.fontSize, 15);
      assert.ok(geometry.list.title.fontFamily.includes('Medium'));
      assert.equal(geometry.list.arrow.width, 28);
      assert.equal(geometry.list.arrow.height, 44);
    }
    fs.writeFileSync(path.join(output, 'current-metrics.json'), JSON.stringify(metrics, null, 2));
    // Render fractional borders at DPR 2; export at the logical viewport size.
    const screenshotOptions = { format: 'png', clip: { x: 0, y: 0, width: test.width, height: test.height, scale: 0.5 } };
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const before = await call('Page.captureScreenshot', screenshotOptions);
    fs.writeFileSync(path.join(output, 'current.png'), Buffer.from(before.data, 'base64'));
    let focus = null;
    if (test.states) {
      assert.equal(metrics.buttons.filter((button) => button.disabled === 'true').length, 2);
      assert.equal(await evaluate('document.querySelector("input").getAttribute("aria-invalid")'), 'true');
      for (const disabled of metrics.buttons.filter((button) => button.disabled === 'true')) {
        await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: disabled.x + disabled.width / 2, y: disabled.y + disabled.height / 2, button: 'left', clickCount: 1 });
        await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: disabled.x + disabled.width / 2, y: disabled.y + disabled.height / 2, button: 'left', clickCount: 1 });
      }
      assert.equal(await evaluate('document.querySelector("[data-testid=inactive-press-count]").textContent'), '0');
    } else if (test.width === 412) {
      const toggle = metrics.switches[0];
      await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: toggle.x + 28, y: toggle.y + 22 });
      await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: toggle.x + 28, y: toggle.y + 22, button: 'left', clickCount: 1 });
      await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: toggle.x + 28, y: toggle.y + 22, button: 'left', clickCount: 1 });
      await waitFor('document.querySelector("[role=switch]").getAttribute("aria-checked") === "false"');
      assert.equal(await evaluate('getComputedStyle(document.querySelector("[role=radio]").firstElementChild.firstElementChild).borderTopWidth'), '1.5px');
      assert.ok((await evaluate('getComputedStyle(document.querySelector("[role=radio]").lastElementChild).fontFamily')).includes('Regular'));
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('[role="checkbox"][aria-label="알림 받기"]').firstElementChild.firstElementChild).borderTopWidth`), '1.5px');
      await evaluate('document.querySelector("input").focus()');
      await waitFor('getComputedStyle(document.querySelector("input")).borderTopColor === "rgb(255, 153, 0)"');
      focus = await evaluate(`(() => { const style = getComputedStyle(document.querySelector('input')); return {
        borderColor: style.borderTopColor, borderWidth: parseFloat(style.borderTopWidth), outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth),
      }; })()`);
      assert.deepEqual(focus, { borderColor: 'rgb(255, 153, 0)', borderWidth: 2, outlineStyle: 'solid', outlineWidth: 0 });
    }
    const name = `${test.states ? 'states' : 'controls'}-${test.width}x${test.height}.png`;
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const capture = await call('Page.captureScreenshot', screenshotOptions);
    fs.writeFileSync(path.join(output, name), Buffer.from(capture.data, 'base64'));
    evidence.push({ ...test, metrics, focus, screenshot: name });
  }
  for (const scene of ['notifications', 'signup']) {
    await call('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 2, mobile: true });
    await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?scene=${scene}` });
    let metrics;
    if (scene === 'notifications') {
      await waitFor('document.body.innerText.includes("알림 패널 미리보기")');
      const bell = await evaluate(`(() => { const r = document.querySelector('[aria-label="알림, 읽지 않은 알림 있음"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...bell, button: 'left', clickCount: 1 });
      await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...bell, button: 'left', clickCount: 1 });
      await waitFor('Boolean(document.querySelector("[data-testid=notification-panel]"))');
      metrics = await evaluate(`(() => {
        const header = document.querySelector('[aria-label="MealChat"]').parentElement.getBoundingClientRect();
        const panel = document.querySelector('[data-testid="notification-panel"]').getBoundingClientRect();
        return { headerTop: header.top, headerBottom: header.bottom, panelTop: panel.top, gap: panel.top - header.bottom };
      })()`);
      assert.equal(metrics.headerTop, 24);
      assert.equal(metrics.headerBottom, 84);
      assert.equal(metrics.gap, 0);
    } else {
      await waitFor('document.querySelector(\'input[aria-label="이메일"]\')?.value === "mealchat@example.test"');
      metrics = await evaluate(`(() => {
        const measure = e => { const r = e.getBoundingClientRect(); return { top: r.top, height: r.height, fontSize: parseFloat(getComputedStyle(e).fontSize) }; };
        const email = document.querySelector('input[aria-label="이메일"]');
        const check = [...document.querySelectorAll('[role="button"]')].find(e => e.innerText === '중복 확인');
        const bank = document.querySelector('[aria-label="은행 선택, 카카오페이"]');
        return { email: measure(email), check: measure(check), bank: measure(bank), bankText: measure(bank.querySelector('[dir="auto"]')),
          fields: ['계좌번호', '생년월일 년', '생년월일 월', '생년월일 일'].map(label => measure([...document.querySelectorAll('input')].find(e => e.getAttribute('aria-label') === label))) };
      })()`);
      assert.equal(metrics.email.height, 52);
      assert.equal(metrics.check.height, 52);
      assert.equal(metrics.email.top, metrics.check.top);
      assert.equal(metrics.bank.height, 52);
      assert.equal(metrics.bankText.fontSize, 16);
      assert.ok(metrics.fields.every(field => field.height === 52 && field.fontSize === 16));
    }
    await evaluate('document.fonts.ready.then(() => true)');
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const capture = await call('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 412, height: 892, scale: 0.5 } });
    const name = `${scene}-412x892.png`;
    fs.writeFileSync(path.join(output, name), Buffer.from(capture.data, 'base64'));
    evidence.push({ scene, metrics, screenshot: name });
  }
  fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify(evidence, null, 2));
  console.log(`PASS: 6 render cases, dimensions, disabled clicks, field focus, notification offset and signup email alignment.\nArtifacts: ${output}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (socket) socket.close();
  if (browser) browser.kill();
  server.close();
});
