<a href="https://zukuapp.github.io/docs/">
  <img src="https://raw.githubusercontent.com/zukuapp/.github/main/profile/assets/developer-hero.png" alt="Trecillo × ZUKU 개발자 문서" width="760">
</a>

# zuku-api: 공개 API 계약

이 저장소는 ZUKU 플랫폼의 **OpenAPI 3.1 계약**과 TypeScript SDK 초안을 보관합니다. 경로·요청·응답 모델은 [`spec/zuku-api-v1.yaml`](spec/zuku-api-v1.yaml)을 기준으로 확인하세요. 명세에 서버 URL이 적혀 있다는 사실만으로 엔드포인트의 현재 가용성, 계정 권한 또는 토큰 발급을 보장하지 않습니다.

## 무엇이 들어 있나요?

| 경로 | 상태 | 용도 |
| --- | --- | --- |
| [`spec/zuku-api-v1.yaml`](spec/zuku-api-v1.yaml) | 공개 계약 | 경로, 인증 스키마, 데이터 모델 |
| [`packages/sdk/src/index.ts`](packages/sdk/src/index.ts) | 실험적 골격 | 일부 타입과 클라이언트 메서드의 초안 |

SDK는 현재 OpenAPI 명세와 완전히 일치하지 않습니다. SDK의 `/content`, `/users/me` 및 커서 기반 페이지네이션은 명세의 `/contents`, `/auth/me` 및 `limit`/`offset` 계약과 다릅니다. **SDK를 운영 API의 완성된 클라이언트로 사용하지 마세요.** `@zuku/sdk`도 npm에 게시되지 않았습니다.

## 명세 읽기

명세의 `servers`에는 `https://api.zuzunza.com/v1`과 샌드박스 URL이 선언되어 있습니다. 실제 서비스 연결 전에는 운영 상태와 접근 권한을 별도로 확인해야 합니다. 인증은 명세의 `BearerAuth`와 `X-API-Key` 보안 스키마를 따릅니다. 브라우저 세션 쿠키는 이 OpenAPI의 공통 보안 스키마로 선언되어 있지 않습니다.

주요 경로는 다음과 같습니다. 아래는 **명세의 경로**이며 호출 성공을 보증하는 예제가 아닙니다.

| 영역 | 경로 예시 |
| --- | --- |
| 인증 | `/auth/register`, `/auth/login`, `/auth/me` |
| 피드 | `/feeds`, `/feeds/hype`, `/feeds/swipe`, `/feeds/jump` |
| 콘텐츠 | `/contents`, `/contents/{id}` |
| 게임 | `/jump/games`, `/jump/games/{id}` |
| 창작자 | `/creators/{handle}` |

명세의 목록 요청은 주로 `limit`과 `offset`을 사용합니다. 페이지 정보의 `PaginationMeta`는 `total`, `limit`, `offset`, `has_more`를 정의합니다. 개별 작업의 응답은 서로 다를 수 있으므로 공통 `status: "ok"` 또는 커서 응답을 임의로 가정하지 말고 해당 작업의 `responses`를 확인하세요.

## 로컬 개발

이 저장소에는 루트 애플리케이션이나 실행 중인 API 서버가 없습니다. SDK 타입을 수정한다면 `packages/sdk`에서 의존성을 설치한 뒤 타입 검사를 실행할 수 있습니다.

```sh
git clone https://github.com/zukuapp/zuku-api.git
cd zuku-api/packages/sdk
npm install
npm run typecheck
```

SDK를 실사용 가능 상태로 만들려면 먼저 OpenAPI의 경로·페이지네이션·응답 형식에 맞추고 계약 테스트를 추가해야 합니다. 명세 변경과 SDK 변경은 같은 변경에서 검토해 주세요.

관련 공개 계약: [Jump 패키지 스키마](https://github.com/zukuapp/zuku-engine-next2d/blob/main/schemas/jump-manifest.schema.json) · [ZWF2 파일 형식](https://github.com/zukuapp/zwf/blob/main/SPEC.md) · [ZUKU 개발자 허브](https://github.com/zukuapp/.github/blob/main/docs/README.md)
