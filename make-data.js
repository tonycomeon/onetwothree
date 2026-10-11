// photos 폴더의 사진 파일 이름으로 quiz-data.js 를 자동 생성합니다.
// 사용법:  node make-data.js   (또는 npm run data)
// 파일 이름 규칙:  001_홍길동.jpg  →  이름 "홍길동"   (앞쪽 숫자와 _ - . 공백은 지워짐)
//
// 주의: macOS 는 한글 파일 이름을 NFD(자모 분리) 로 돌려주지만, Git(core.precomposeunicode=true) 과
// GitHub Pages 는 NFC(완성형) 로 저장/서빙합니다. 그래서 이름과 경로를 모두 NFC 로 정규화해서 적습니다.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'photos');
const OUT = path.join(__dirname, 'quiz-data.js');
const IMG_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const IGNORE = /^(\..*|.*\.(txt|md))$/i;          // 숨김 파일, 안내용 txt/md 는 무시
const MAX_BYTES = 1024 * 1024;                     // 1 MB 넘으면 경고 (아이패드 로딩 속도)

if (!fs.existsSync(dir)) {
  console.error('photos 폴더가 없어요. 이 파일과 같은 위치에 photos 폴더를 만들고 사진을 넣어 주세요.');
  process.exit(1);
}

const all = fs.readdirSync(dir).filter(f => !IGNORE.test(f));
const files = all.filter(f => IMG_EXT.test(f))
  .map(f => f.normalize('NFC'))
  .sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));

const warnings = [];
const unsupported = all.filter(f => !IMG_EXT.test(f));
if (unsupported.length) warnings.push(`지원하지 않는 확장자 (건너뜀): ${unsupported.join(', ')}  ← jpg/jpeg/png/webp/gif/avif 로 바꿔 주세요`);

const items = files.map(f => {
  const name = f.replace(/\.[^.]+$/, '').replace(/^\d+[\s._-]+/, '').trim().normalize('NFC');
  const photo = ('photos/' + f).normalize('NFC');
  const size = fs.statSync(path.join(dir, f)).size;
  if (size > MAX_BYTES) warnings.push(`1 MB 초과: ${photo} (${(size / 1024 / 1024).toFixed(2)} MB) ← 줄이면 로딩이 빨라져요`);
  return { name, photo };
});

const seen = new Map();
items.forEach(x => { seen.set(x.name, (seen.get(x.name) || []).concat(x.photo)); });
[...seen].filter(([, v]) => v.length > 1).forEach(([n, v]) => warnings.push(`이름 중복: "${n}" ← ${v.join(', ')}`));
const odd = items.filter(x => !x.name || /^(IMG|DSC|DSCN|PXL|image|photo|Screenshot)[\s_-]?\d/i.test(x.name) || /^\d+$/.test(x.name));
if (odd.length) warnings.push(`이름 확인 필요: ${odd.map(x => x.photo).join(', ')}`);

const generated = new Date().toLocaleString('ko-KR');
const body = items.map(x => `  { name: ${JSON.stringify(x.name)}, photo: ${JSON.stringify(x.photo)} },`).join('\n');
const out = `// node make-data.js 로 자동 생성됨 (${generated})
// 이름이 틀린 게 있으면 여기서 직접 고쳐도 됩니다. (파일 경로는 NFC 한글이어야 GitHub Pages 에서 열립니다)
window.QUIZ_DATA_GENERATED = ${JSON.stringify(generated)};
window.QUIZ_DATA = [
${body}
];
`;
try { fs.writeFileSync(OUT, out); }
catch (e) {
  if (e.code === 'EACCES') { console.error('quiz-data.js 에 쓸 수 없어요 (읽기 전용). 먼저 실행:  chmod u+w quiz-data.js'); process.exit(1); }
  throw e;
}
console.log(`quiz-data.js 생성 완료: ${items.length}명`);
warnings.forEach(w => console.warn('⚠️  ' + w));
