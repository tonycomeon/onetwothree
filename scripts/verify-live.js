#!/usr/bin/env node
// 배포된 GitHub Pages 의 index.html, quiz-data.js, 모든 사진 URL 을 요청해서 200 이 아닌 것을 보고합니다.
// 사용법: npm run verify-live      (다른 주소: LIVE_BASE=https://... npm run verify-live)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const BASE = (process.env.LIVE_BASE || pkg.config.liveBase).replace(/\/?$/, '/');
const enc = p => p.split('/').map(encodeURIComponent).join('/');
const bust = () => '?t=' + Date.now();

function parseData(src) {
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { timeout: 2000 });
  return { data: sandbox.window.QUIZ_DATA || [], generated: sandbox.window.QUIZ_DATA_GENERATED || (src.split('\n')[0].match(/\((.+)\)/) || [])[1] || '' };
}
async function head(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return { url, status: r.status, cc: r.headers.get('cache-control'), age: r.headers.get('age'), lm: r.headers.get('last-modified') };
  } catch (e) { return { url, status: 'ERR', error: e.message }; }
}

(async () => {
  let bad = 0;
  console.log('라이브 주소:', BASE);
  for (const f of ['index.html', 'quiz-data.js']) {
    const r = await head(BASE + f + bust());
    console.log(`${r.status === 200 ? '✅' : '❌'} ${f}  status=${r.status}  cache-control=${r.cc}  last-modified=${r.lm}`);
    if (r.status !== 200) bad++;
  }
  // 라이브 quiz-data.js 내용과 로컬 비교
  let live = { data: [], generated: '' };
  try {
    const txt = await (await fetch(BASE + 'quiz-data.js' + bust(), { cache: 'no-store' })).text();
    live = parseData(txt);
    const localTxt = fs.readFileSync(path.join(root, 'quiz-data.js'), 'utf8');
    const local = parseData(localTxt);
    console.log(`라이브 quiz-data.js: ${live.data.length}개 (생성 ${live.generated || '?'}) · 로컬: ${local.data.length}개 (생성 ${local.generated || '?'})`);
    if (txt !== localTxt) console.log('⚠️  라이브 quiz-data.js 가 로컬과 달라요. 아직 배포 중이거나(1~2분 대기) push 를 안 했을 수 있어요.');
    const nfd = live.data.filter(d => d.photo !== String(d.photo).normalize('NFC'));
    if (nfd.length) { console.log(`❌ 라이브 데이터에 NFD 경로 ${nfd.length}개`); bad++; }
  } catch (e) { console.log('❌ 라이브 quiz-data.js 를 읽지 못했어요:', e.message); bad++; }

  // 라이브 데이터 + 로컬 데이터의 모든 사진 URL
  const localData = parseData(fs.readFileSync(path.join(root, 'quiz-data.js'), 'utf8')).data;
  const photos = [...new Set([...live.data, ...localData].map(d => d.photo).filter(Boolean))];
  const results = [];
  for (let i = 0; i < photos.length; i += 20) results.push(...await Promise.all(photos.slice(i, i + 20).map(p => head(BASE + enc(p)))));
  const nonOk = results.filter(r => r.status !== 200);
  console.log(`사진 ${results.length}개 확인: 200 → ${results.length - nonOk.length}개, 그 외 → ${nonOk.length}개`);
  nonOk.forEach(r => console.log(`❌ ${r.status}  ${decodeURIComponent(r.url)}${r.error ? '  ' + r.error : ''}`));
  bad += nonOk.length;
  const cc = results.find(r => r.cc); if (cc) console.log('사진 cache-control:', cc.cc);
  if (bad) { console.log(`\n❌ 문제 ${bad}건`); process.exit(1); }
  console.log('\n✅ 라이브 전부 정상');
})();
