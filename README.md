# zuku-api

ZUKU(즈쿠) 플랫폼 **OpenAPI 3.1 계약**과 관련 SDK 패키지입니다.

> 서비스: [zuzunza.com](https://zuzunza.com) · 스펙: [`spec/zuku-api-v1.yaml`](spec/zuku-api-v1.yaml)

## Base URL

```
https://api.zuzunza.com/v1/
```

## 인증

- **OAuth 2.0 / Bearer**: `Authorization: Bearer <token>`
- **세션 쿠키**: 브라우저 클라이언트

## 버전

URL 기반: `/v1/`, `/v2/` … 호환이 깨지면 메이저 버전을 올립니다.

## 페이지네이션

커서 기반:

```json
{
  "status": "ok",
  "data": [],
  "meta": {
    "cursor": "next_page_token",
    "has_more": true
  }
}
```

## 핵심 리소스

| 리소스 | 엔드포인트 | 설명 |
|--------|------------|------|
| Content | `/v1/content` | UGC 미디어 |
| Users | `/v1/users` | 프로필 |
| Auth | `/v1/auth` | 인증 |
| Media | `/v1/media` | 업로드/다운로드 |
| Comments | `/v1/comments` | 댓글 |

## SDK

```bash
npm install @zuku/sdk
```

세부: [`packages/sdk/`](packages/sdk/)

## 관련

| 저장소 | 역할 |
|--------|------|
| [zuku-cli](https://github.com/zukuapp/zuku-cli) | Jump CLI |
| [zuku-engine-next2d](https://github.com/zukuapp/zuku-engine-next2d) | Jump 엔진·매니페스트 |
| [zuku-docs](https://github.com/zukuapp/zuku-docs) | 설계도 |
| [shizuku](https://github.com/zukuapp/shizuku) | 공개 홈·문서 인덱스 |

---

**ZUKU (즈쿠)** · Tresillo · [zuzunza.com](https://zuzunza.com)
