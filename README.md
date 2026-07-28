# 2D 액션 플랫포머 프로토타입

정적 HTML/JS/Canvas로만 만든 프로토타입입니다. 별도 빌드 과정 없이 `index.html`을 열면 바로 실행됩니다.

## 로컬에서 실행

`index.html` 파일을 브라우저로 더블클릭해서 열어도 되고, 로컬 서버로 띄워도 됩니다.

```
npx serve .
```

## 조작

- ← → : 이동
- Z : 점프 (이단 점프)
- X : 대쉬 (짧은 무적시간, 쿨타임 있음)
- C : 근접 공격

## 밸런스 조정

`index.html` 상단 `<script>` 안의 `CONFIG` 객체에 이동 속도, 대쉬 거리/쿨타임, 공격 판정, 적 발사 주기 등 모든 밸런스 수치가 모여 있습니다. 코드 로직을 건드리지 않고 여기 숫자만 바꿔서 튜닝할 수 있습니다.

## Vercel 배포

이 프로젝트는 순수 정적 파일이라 빌드 설정이 필요 없습니다.

1. GitHub에 저장소를 만들고 이 폴더를 push
2. https://vercel.com 에서 "Add New... > Project"로 해당 GitHub 저장소를 import
3. Framework Preset은 "Other"로 두면 됩니다 (빌드 커맨드 없이 `index.html`을 그대로 서빙)
4. Deploy 클릭하면 끝

CLI로 배포하려면:

```
npm i -g vercel
vercel
```
