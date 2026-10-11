# 하나 둘 셋! 인물 퀴즈 — 프로젝트 안내 (Claude/사람 공용)

아이패드에서 인물 사진을 보고 "하나·둘·셋" 안에 이름을 맞히는 정적 웹 게임. 3명 연속 정답이면 성공.
사용자에게는 **한국어로** 답한다.

- 저장소: `tonycomeon/onetwothree` (branch `main`, 루트에서 GitHub Pages 배포)
- 라이브 주소: https://tonycomeon.github.io/onetwothree/  (디버그: `?debug=1`)
- 로컬 폴더: `~/Downloads/hanadulset-quiz` (이 폴더가 곧 저장소 루트)

## 파일 구성
| 파일 | 역할 |
|---|---|
| `index.html` | 게임 전체 (CSS/JS 인라인). `quiz-data.js?t=<시각>` 을 동적 script 로 불러온 뒤 문제 목록 구성. 사진은 경로 그대로 → NFC → NFD 순으로 시도하고 전부 실패해야 "사진을 불러올 수 없어요" 표시 + `console.warn`. `?debug=1` 로 디버그 오버레이(문제 수, 생성 시각, 실패 URL). 문제 관리 화면의 사진 추가는 IndexedDB(기기별). |
| `quiz-data.js` | `window.QUIZ_DATA = [{ name, photo: "photos/파일" }, ...]` + `window.QUIZ_DATA_GENERATED`. **직접 쓰지 말고 `npm run data` 로 생성.** |
| `make-data.js` | `photos/` 를 읽어 `quiz-data.js` 생성. 이름·경로 NFC 정규화, 한국어 정렬, 중복 이름 / 미지원 확장자 / 1 MB 초과 경고. |
| `photos/` | 사진 100장. 파일명 = 인물 이름 (`강호동.webp`, `001_홍길동.jpg` 도 가능). jpg/jpeg/png/webp/gif/avif. |
| `scripts/check.js` | 데이터 ↔ photos/ ↔ git 일관성 검사 (아래 참고). |
| `scripts/verify-live.js` | 라이브 index.html, quiz-data.js, 모든 사진 URL HEAD 요청 → 200 아닌 것 보고. |
| `scripts/deploy.js` | check 통과 시 `git add -A && commit && push`. |
| `README.md` | 사용자용 게임 설명. |

## npm 스크립트 (의존성 없음, Node ≥ 18)
```
npm run data         # photos/ → quiz-data.js
npm run check        # 검사: 모든 항목이 photos/ 와 git ls-files 에 바이트 단위로 존재, 전부 NFC, 빈 이름 없음, index.html 이 게임 파일인지. 문제 있으면 exit 1
npm run serve        # http://127.0.0.1:8080  (python3 http.server)
npm run verify-live  # 배포 결과 확인 (push 후 1~2분 뒤 실행)
npm run deploy       # check → 커밋 메시지 질문 → add/commit/push   (npm run deploy -- "메시지" 로 바로)
```

## 데이터 작업 순서 (사진 추가/교체/삭제)
1. `photos/` 에 사진을 넣거나 지운다 (파일명 = 이름).
2. `npm run data`
3. `npm run check`  (❌ 가 있으면 고친다)
4. `npm run deploy` → 1~2분 뒤 `npm run verify-live`
5. 브라우저에서 **Shift+새로고침**(강력 새로고침) 후 확인. 아이패드 Safari 는 홈 화면 앱을 완전히 닫았다 다시 연다.

이름만 고칠 때: 파일명을 바꾸고(`git mv` 권장) `npm run data`. quiz-data.js 를 손으로 고치면 다음 `npm run data` 때 덮어써진다.

## 알려진 함정 (반드시 읽기)
- **NFC vs NFD 한글 파일명.** macOS 는 `readdir` 결과를 NFD(자모 분리)로 돌려주지만 Git(`core.precomposeunicode=true`)과 GitHub Pages 는 NFC 로 저장·서빙한다. quiz-data.js 의 경로가 NFD 면 **라이브에서 모든 사진이 404** 가 난다(로컬 Mac 에서는 APFS 가 둘을 같은 파일로 취급해 멀쩡해 보임). make-data.js 가 NFC 로 정규화하고 check.js 가 git ls-files 와 바이트 단위로 비교한다. 로컬 서버 테스트로는 이 문제를 잡을 수 없다 → `npm run check` / `npm run verify-live` 를 믿을 것.
- **브라우저 캐시 (max-age=600).** GitHub Pages 는 모든 파일을 10분 캐시로 내려 준다. 고친 뒤 바로 보면 옛 index.html / quiz-data.js 가 보일 수 있다. quiz-data.js 는 `?t=` 로 우회하지만 index.html 자체는 우회 불가 → 사용자에게 **강력 새로고침**(Mac Chrome: Cmd+Shift+R, Safari: Cmd+Option+R) 또는 시크릿 창을 안내한다. 2026-10-11 에 "사진을 불러올 수 없어요" 가 전부 뜬 원인도 서버가 아니라 이 캐시(옛 NFD quiz-data.js)였다.
- **읽기 전용 파일.** 원본 zip 에서 꺼낸 파일은 `r--r--r--` 라서 쓰기 시 EACCES. 편집 전 `chmod u+w <파일>` (README.md 는 아직 읽기 전용).
- **절대 `~/Downloads` 의 다른 index.html 을 이 폴더 위로 복사하지 말 것.** 한 번 엉뚱한 1372줄짜리 index.html 이 커밋됐다가(84a9702) 되돌렸다(d732aae). check.js 가 index.html 에 `하나 둘 셋! 인물 퀴즈` 와 `QUIZ_DATA` 가 있는지 확인한다. 사고가 나면 `git checkout index.html`.
- **앱 안에서 추가한 사진(IndexedDB)은 그 기기·그 브라우저에만 있다.** 다른 기기나 Pages 에는 반영되지 않는다. 모두에게 보여야 하는 사진은 `photos/` 에 넣고 위 순서대로 배포한다.
- 게임의 "나온 문제" 기록(localStorage `hds.used.v1`)은 `'f:' + photo + '|' + name` 키를 쓴다. 경로/이름이 바뀌면 새 문제로 취급되며, 홈의 "나온 문제 초기화" 로 지운다.
- `photos/윈터.png` 는 1 MB 가 넘는다(경고만). 줄이면 아이패드 로딩이 빨라진다.

## 진단할 때 쓰는 명령
```
git status && git log -5 --oneline
npm run check
curl -sI https://tonycomeon.github.io/onetwothree/quiz-data.js | grep -iE 'HTTP|cache|last-modified'
npm run verify-live
gh api repos/tonycomeon/onetwothree/pages/builds/latest --jq '{status,commit,updated_at}'
```
로컬 브라우저 테스트: `npm run serve` 후 http://127.0.0.1:8080/?debug=1 . Playwright 는 전역 설치돼 있지 않다(`~/.npm/_npx/*/node_modules/playwright` 캐시를 `NODE_PATH` 로 쓸 수 있음).

## 코드 규칙
- UI 문구는 전부 한국어. 기존 어두운 테마·게임 규칙(하나/둘/셋 카운트, 진행자가 정답/오답 판정, 연속 N명 성공) 유지.
- 외부 의존성 추가 금지(정적 파일만). index.html 은 한 파일 유지.
- 커밋 전 반드시 `npm run check`. 커밋/푸시는 `npm run deploy` 로.
