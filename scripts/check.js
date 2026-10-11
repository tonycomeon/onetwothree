#!/usr/bin/env node
// quiz-data.js 와 photos/ 와 git 이 서로 맞는지 검사합니다. 문제가 있으면 종료 코드 1.
// 사용법: npm run check
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const errors = [], warns = [];
const err = m => errors.push(m), warn = m => warns.push(m);
const isNFC = s => s === s.normalize('NFC');
const show = s => s + (isNFC(s) ? '' : '  [NFD]');

// 1) quiz-data.js 읽기 (eval 대신 샌드박스)
let data = [], generated = '';
try {
  const src = fs.readFileSync(path.join(root, 'quiz-data.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { timeout: 2000 });
  data = Array.isArray(sandbox.window.QUIZ_DATA) ? sandbox.window.QUIZ_DATA : null;
  generated = sandbox.window.QUIZ_DATA_GENERATED || (src.split('\n')[0].match(/\((.+)\)/) || [])[1] || '';
  if (!data) err('quiz-data.js 에 window.QUIZ_DATA 배열이 없어요.');
} catch (e) { err('quiz-data.js 를 읽을 수 없어요: ' + e.message); }
data = data || [];

// 2) 디스크 / git 파일 목록
const photosDir = path.join(root, 'photos');
const disk = fs.existsSync(photosDir) ? fs.readdirSync(photosDir).filter(f => !f.startsWith('.')) : [];
const diskNFC = new Set(disk.map(f => 'photos/' + f.normalize('NFC')));
let git = [];
try {
  git = cp.execSync('git -c core.quotepath=off ls-files -z -- photos', { cwd: root }).toString().split('\0').filter(Boolean);
} catch (e) { err('git ls-files 실행 실패: ' + e.message); }
const gitSet = new Set(git);
git.filter(g => !isNFC(g)).forEach(g => err(`git 에 NFD 파일명이 들어가 있어요: ${g}  ← git mv 로 NFC 이름으로 바꿔 주세요`));

// 3) 항목별 검사
const seenPhoto = new Map(), seenName = new Map();
data.forEach((d, i) => {
  const tag = `#${i + 1}`;
  if (!d || typeof d !== 'object') return err(`${tag}: 항목 형식이 이상해요`);
  const name = d.name == null ? '' : String(d.name), photo = d.photo == null ? '' : String(d.photo);
  if (!name.trim()) err(`${tag} (${photo || '경로 없음'}): 이름이 비어 있어요`);
  if (!photo) err(`${tag} (${name}): photo 경로가 비어 있어요`);
  if (name && !isNFC(name)) err(`${tag}: 이름이 NFC 가 아니에요: ${name}`);
  if (photo && !isNFC(photo)) err(`${tag}: 경로가 NFC 가 아니에요: ${photo}`);
  if (photo) {
    if (!photo.startsWith('photos/')) err(`${tag}: 경로는 photos/ 로 시작해야 해요: ${photo}`);
    // 디스크: macOS 는 NFC/NFD 를 같은 파일로 보므로 NFC 로 비교 (리눅스/CI 에서는 실제 존재 여부도 확인)
    if (!diskNFC.has(photo.normalize('NFC')) && !fs.existsSync(path.join(root, photo))) err(`${tag}: photos/ 폴더에 파일이 없어요: ${photo}`);
    // git: 바이트 단위로 동일해야 Pages 에서 열림
    if (!gitSet.has(photo)) {
      const near = git.find(g => g.normalize('NFC') === photo.normalize('NFC'));
      err(`${tag}: git 추적 파일과 바이트 단위로 일치하지 않아요: ${show(photo)}` + (near ? `  (git 에는 ${show(near)} 로 있음)` : '  (git add 안 됨?)'));
    }
    seenPhoto.set(photo, (seenPhoto.get(photo) || 0) + 1);
  }
  if (name.trim()) seenName.set(name.trim(), (seenName.get(name.trim()) || []).concat(photo));
});
[...seenPhoto].filter(([, n]) => n > 1).forEach(([p, n]) => err(`같은 사진이 ${n}번 들어 있어요: ${p}`));
[...seenName].filter(([, v]) => v.length > 1).forEach(([n, v]) => warn(`이름 중복: "${n}" ← ${v.join(', ')}`));

// 4) 반대 방향: git/디스크에는 있는데 quiz-data.js 에 없는 사진
const dataSet = new Set(data.map(d => d && d.photo));
const IMG_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
git.filter(g => IMG_EXT.test(g) && !dataSet.has(g)).forEach(g => warn(`git 에는 있지만 quiz-data.js 에 없는 사진: ${g}  ← npm run data 실행`));
disk.filter(f => IMG_EXT.test(f) && !gitSet.has('photos/' + f.normalize('NFC'))).forEach(f => warn(`아직 git 에 추가되지 않은 사진: photos/${f}  ← npm run deploy 가 추가함`));
disk.filter(f => !IMG_EXT.test(f) && !/\.(txt|md)$/i.test(f)).forEach(f => warn(`지원하지 않는 확장자: photos/${f}`));

// 5) index.html 이 게임 파일인지 (엉뚱한 index.html 덮어쓰기 방지)
try {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (!html.includes('하나 둘 셋! 인물 퀴즈') || !html.includes('QUIZ_DATA')) err('index.html 이 인물 퀴즈 게임 파일이 아닌 것 같아요! (다른 index.html 을 덮어썼나요? git checkout index.html 로 복구)');
  if (/<script src="quiz-data\.js"><\/script>/.test(html)) warn('index.html 이 quiz-data.js 를 고정 태그로 불러와요 (캐시 우회 안 됨)');
} catch (e) { err('index.html 을 읽을 수 없어요: ' + e.message); }

// 결과
console.log(`quiz-data.js: ${data.length}개 항목${generated ? ` (생성: ${generated})` : ''} · photos/: ${disk.filter(f => IMG_EXT.test(f)).length}장 · git 추적: ${git.filter(g => IMG_EXT.test(g)).length}장`);
warns.forEach(w => console.log('⚠️  ' + w));
errors.forEach(e => console.log('❌ ' + e));
if (errors.length) { console.log(`\n검사 실패: 문제 ${errors.length}건`); process.exit(1); }
console.log(`✅ 검사 통과 (경고 ${warns.length}건)`);
