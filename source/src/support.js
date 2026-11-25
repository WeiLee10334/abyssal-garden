// ============================================================================
// can this device run the scene? If not: why not, and what the visitor can do about it
// ============================================================================
// Add ?diag to the address to see the report on a device that works.
const ZH = /^zh/i.test(navigator.language || '');
const tr = (en, zh) => (ZH ? zh : en);
const UA = navigator.userAgent, uad = navigator.userAgentData;
const uaN = (re) => +(UA.match(re) || [])[1] || 0;
const ENV = {
  ios: /iP(hone|ad|od)/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1),
  android: /Android/.test(UA),
  // browsers inside other apps (LINE, Facebook, Instagram, WeChat) and Android WebView
  inapp: /\bLine\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|; wv\)/.test(UA),
  ff: uaN(/(?:Firefox|FxiOS)\/(\d+)/), chrome: uaN(/(?:Chrome|CriOS)\/(\d+)/), samsung: uaN(/SamsungBrowser\/(\d+)/),
  safari: /Safari\//.test(UA) && !/Chrome|CriOS|FxiOS|Edg|OPR|Android/.test(UA) ? uaN(/Version\/(\d+)/) : 0,
};
// stage: 'nogpu' (no navigator.gpu), 'noadapter', 'nodevice', 'lost'. Returns { head, steps: [html], info }
async function diagnose(stage, err) {
  // the address bar's Android version is frozen at 10: ask Chromium for the real one
  let osv = 0, model = '', compat = 0;
  try { const h = await uad.getHighEntropyValues(['platformVersion', 'model']); osv = parseInt(h.platformVersion) || 0; model = h.model || ''; } catch {}
  // a device without Vulkan 1.1 may still offer the OpenGL ES "compatibility" flavour, which is not enough here
  try { compat = stage === 'noadapter' && !!(await navigator.gpu.requestAdapter({ featureLevel: 'compatibility' })); } catch {}
  const E = ENV, s = [], c = (t) => '<code>' + t + '</code>';
  const flag = tr(`Open ${c('chrome://flags/#enable-unsafe-webgpu')} in a new tab, set it to <b>Enabled</b> and tap <b>Relaunch</b>. This lifts Chrome's list of approved graphics chips; it is experimental. (Tap the address to copy it.)`,
    `在新分頁開啟 ${c('chrome://flags/#enable-unsafe-webgpu')}，改成 <b>Enabled</b> 後按 <b>Relaunch</b>。這會解除 Chrome 的繪圖晶片核可名單，屬於實驗性功能。（點一下網址即可複製。）`);
  const gpuPage = tr(`${c('chrome://gpu')} shows what Chrome decided: look for the <b>WebGPU</b> line.`, `${c('chrome://gpu')} 可以看到 Chrome 的判斷結果，找 <b>WebGPU</b> 那一行。`);
  let head = tr('WebGPU is not available here', '這裡無法使用 WebGPU');
  if (!isSecureContext) {
    head = tr('This page needs https', '本頁需要 https 連線');
    s.push(tr('Browsers only offer WebGPU on secure pages. Open the https:// address of this page.', '瀏覽器只在安全連線下提供 WebGPU，請改用本頁的 https:// 網址開啟。'));
  } else if (stage === 'lost' || stage === 'nodevice') {
    head = stage === 'lost' ? tr('The graphics device was lost', '繪圖裝置中斷了') : tr('The graphics device could not be started', '繪圖裝置無法啟動');
    s.push(tr('Usually the device ran out of graphics memory. Close other tabs and apps, then check again.', '通常是繪圖記憶體不足。請關閉其他分頁與 App 後再重新檢查。'));
    s.push(tr('The scene already runs on its lowest detail level on this device.', '場景在這台裝置上已經使用最低畫質。'));
  } else if (E.ios) {
    head = tr('WebGPU is off on this iPhone / iPad', '這台 iPhone／iPad 尚未開啟 WebGPU');
    s.push(tr('It is on from <b>iOS / iPadOS 26</b>: Settings › General › Software Update.', '<b>iOS／iPadOS 26</b> 起預設開啟：設定 › 一般 › 軟體更新。'));
    s.push(tr('On iOS 17.4 to 18 there is a preview, in Safari only: Settings › Apps › Safari › Advanced › Feature Flags › <b>WebGPU</b>, then close and reopen Safari.', 'iOS 17.4 到 18 有預覽版，僅限 Safari：設定 › App › Safari › 進階 › 功能旗標 › 開啟 <b>WebGPU</b>，再關掉 Safari 重開。'));
    if (E.inapp || !E.safari) s.push(tr('You are not in Safari. Open this page in Safari: the preview switch does not reach other apps.', '目前不是用 Safari 開啟。請改用 Safari：預覽版開關對其他 App 無效。'));
    s.push(tr('Every browser on iPhone uses the same engine, so another browser will not help.', 'iPhone 上所有瀏覽器都用同一個引擎，換瀏覽器不會有幫助。'));
  } else if (E.android) {
    head = tr('WebGPU is off in this browser', '這個瀏覽器尚未開啟 WebGPU');
    if (E.inapp) s.push(tr('This is a browser inside another app. Open the menu (⋮) and choose <b>Open in Chrome</b>.', '目前是在其他 App 的內建瀏覽器中。請點選單（⋮）選擇<b>以 Chrome 開啟</b>。'));
    else if (E.ff) {
      s.push(tr('Firefox for Android does not turn WebGPU on yet. Open this page in <b>Chrome</b>.', 'Android 版 Firefox 尚未預設開啟 WebGPU，請改用 <b>Chrome</b> 開啟本頁。'));
      s.push(tr(`To stay with Firefox: in Firefox Beta or Nightly open ${c('about:config')} and set ${c('gfx.webgpu.ignore-blocklist')} to true.`, `若要留在 Firefox：在 Firefox Beta 或 Nightly 開啟 ${c('about:config')}，把 ${c('gfx.webgpu.ignore-blocklist')} 設為 true。`));
    } else {
      if (E.samsung || !E.chrome) s.push(tr('Open this page in <b>Chrome</b>.', '請改用 <b>Chrome</b> 開啟本頁。'));
      if (E.chrome && E.chrome < 121) s.push(tr(`Update Chrome: you have ${E.chrome}, WebGPU on Android starts at 121.`, `請更新 Chrome：目前是 ${E.chrome} 版，Android 上的 WebGPU 從 121 版開始。`));
      if (osv && osv < 12) s.push(tr(`This is Android ${osv}. Chrome turns WebGPU on from Android 12; a system update is the lasting fix.`, `這台是 Android ${osv}。Chrome 從 Android 12 起才預設開啟 WebGPU，更新系統是根本解法。`));
      if (stage === 'nogpu' && (!E.chrome || E.chrome >= 121) && !(osv && osv < 12)) s.push(tr('Chrome and Android are new enough, so the graphics chip is not on Chrome\'s approved list yet (some Samsung Exynos / Xclipse and PowerVR phones).', 'Chrome 與 Android 版本都夠新，代表這顆繪圖晶片還不在 Chrome 的核可名單內（部分 Samsung Exynos／Xclipse 與 PowerVR 機型）。'));
      s.push(flag, gpuPage);
    }
  } else if (E.ff) {
    head = tr('WebGPU is off in this Firefox', '這個 Firefox 尚未開啟 WebGPU');
    s.push(tr('Firefox has WebGPU on Windows from version 141 and on Apple-silicon Macs from 145. Update Firefox, or open this page in Chrome or Edge.', 'Firefox 在 Windows 從 141 版、Apple 晶片 Mac 從 145 版起支援 WebGPU。請更新 Firefox，或改用 Chrome／Edge。'));
  } else if (E.safari) {
    head = tr('WebGPU is off in this Safari', '這個 Safari 尚未開啟 WebGPU');
    s.push(tr('Safari has WebGPU from version 26 (macOS Tahoe 26). Update macOS, or open this page in Chrome.', 'Safari 從 26 版（macOS Tahoe 26）起支援 WebGPU。請更新 macOS，或改用 Chrome 開啟。'));
  } else {
    if (E.chrome && E.chrome < 113) s.push(tr(`Update your browser: you have version ${E.chrome}, WebGPU starts at 113.`, `請更新瀏覽器：目前是 ${E.chrome} 版，WebGPU 從 113 版開始。`));
    s.push(tr(`Turn on <b>Use graphics acceleration when available</b> in ${c('chrome://settings/system')} and restart the browser.`, `到 ${c('chrome://settings/system')} 開啟<b>在可用時使用圖形加速功能</b>，然後重新啟動瀏覽器。`));
    s.push(flag + (/Linux/.test(UA) ? tr(` On Linux also enable ${c('chrome://flags/#enable-vulkan')}.`, ` Linux 需一併開啟 ${c('chrome://flags/#enable-vulkan')}。`) : ''), gpuPage);
  }
  if (stage === 'noadapter' && isSecureContext) {
    head = tr('The browser has WebGPU, but offered no graphics device', '瀏覽器有 WebGPU，但沒有提供可用的繪圖裝置');
    if (compat) s.unshift(tr('This device only offers WebGPU\'s OpenGL ES compatibility mode. The scene needs full WebGPU (Vulkan 1.1), so it cannot run here.', '這台裝置只提供 WebGPU 的 OpenGL ES 相容模式。本場景需要完整的 WebGPU（Vulkan 1.1），因此無法在此執行。'));
    else s.unshift(tr('Close and reopen the browser first: the graphics process may have crashed.', '請先把瀏覽器完全關閉再重開：繪圖程序可能當掉了。'));
  }
  if (stage === 'diag') { head = tr('WebGPU works on this device', '這台裝置支援 WebGPU'); s.unshift(tr('Shown because the address has ?diag. Below is what this browser would be told if WebGPU were missing.', '因網址帶有 ?diag 而顯示。以下是這個瀏覽器在沒有 WebGPU 時會看到的指引。')); }
  const os = E.ios ? 'iOS' : E.android ? 'Android' + (osv ? ' ' + osv : '') : (UA.match(/Windows|Mac OS X|Linux|CrOS/) || ['?'])[0];
  const br = E.ff ? 'Firefox ' + E.ff : E.samsung ? 'Samsung Internet ' + E.samsung : E.safari ? 'Safari ' + E.safari : E.chrome ? 'Chromium ' + E.chrome : '?';
  const info = [br + (E.inapp ? ' (in-app)' : ''), os, model, 'https ' + (isSecureContext ? '✓' : '✗'), 'navigator.gpu ' + (navigator.gpu ? '✓' : '✗'), stage, err && err.message].filter(Boolean).join(' · ');
  return { head, steps: s, info };
}
