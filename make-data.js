// photos 폴더의 사진 파일 이름으로 quiz-data.js 를 자동 생성합니다.
// 사용법:  node make-data.js
// 파일 이름 규칙:  001_홍길동.jpg  →  이름 "홍길동"   (앞쪽 숫자와 _ - . 공백은 지워짐)
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'photos');
if (!fs.existsSync(dir)) {
  console.error('photos 폴더가 없어요. 이 파일과 같은 위치에 photos 폴더를 만들고 사진을 넣어 주세요.');
  process.exit(1);
}

const files = fs.readdirSync(dir)
  .filter(f => /\.(jpe?g|png|webp|gif|avif)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));

const items = files.map(f => {
  const name = f.normalize('NFC').replace(/\.[^.]+$/, '').replace(/^\d+[\s._-]+/, '').trim();
  return { name, photo: ('photos/' + f).normalize('NFC') };
});

const body = items.map(x => `  { name: ${JSON.stringify(x.name)}, photo: ${JSON.stringify(x.photo)} },`).join('\n');
const out = `// node make-data.js 로 자동 생성됨 (${new Date().toLocaleString('ko-KR')})
// 이름이 틀린 게 있으면 여기서 직접 고쳐도 됩니다.
window.QUIZ_DATA = [
${body}
];
`;
fs.writeFileSync(path.join(__dirname, 'quiz-data.js'), out);
console.log(`quiz-data.js 생성 완료: ${items.length}명`);
const odd = items.filter(x => !x.name || /^(IMG|DSC|PXL)/i.test(x.name));
if (odd.length) console.log('이름 확인 필요:', odd.map(x => x.photo).join(', '));
