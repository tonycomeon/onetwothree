#!/usr/bin/env node
// npm run check 를 통과하면 git add → commit → push 합니다.
// 사용법: npm run deploy            (커밋 메시지를 물어봄)
//        npm run deploy -- "메시지"  (바로 커밋)
const cp = require('child_process');
const path = require('path');
const readline = require('readline');

const root = path.resolve(__dirname, '..');
const run = (cmd, opts = {}) => cp.execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
const out = cmd => cp.execSync(cmd, { cwd: root }).toString();

const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'check.js')], { cwd: root, stdio: 'inherit' });
if (r.status !== 0) { console.log('\n검사에 실패해서 배포를 중단했어요. 위 ❌ 항목을 고친 뒤 다시 실행하세요.'); process.exit(1); }

const branch = out('git rev-parse --abbrev-ref HEAD').trim();
const status = out('git status --porcelain');
if (!status.trim()) {
  console.log('커밋할 변경 사항이 없어요.');
  const ahead = out(`git rev-list --count origin/${branch}..HEAD`).trim();
  if (ahead !== '0') { console.log(`push 안 된 커밋 ${ahead}개가 있어서 push 만 합니다.`); run(`git push origin ${branch}`); }
  process.exit(0);
}
console.log('\n변경 사항:'); run('git status --short');

(async () => {
  let msg = process.argv.slice(2).join(' ').trim();
  if (!msg) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    msg = (await new Promise(res => rl.question('\n커밋 메시지: ', res))).trim();
    rl.close();
  }
  if (!msg) { console.log('커밋 메시지가 비어 있어서 중단했어요.'); process.exit(1); }
  run('git add -A');
  cp.execFileSync('git', ['commit', '-m', msg], { cwd: root, stdio: 'inherit' });
  run(`git push origin ${branch}`);
  const base = require(path.join(root, 'package.json')).config.liveBase;
  console.log(`\n✅ push 완료. GitHub Pages 반영까지 보통 1~2분 걸려요.\n   확인: npm run verify-live\n   주소: ${base}  (브라우저는 Shift+새로고침 으로 캐시 비우기)`);
})();
