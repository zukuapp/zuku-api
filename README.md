# zuku-api

zuku Platform API specification and SDK packages.

## API Specification

The OpenAPI 3.1 specification is available at [spec/zuku-api-v1.yaml](spec/zuku-api-v1.yaml).

## Base URL

```
https://api.zuzunza.com/v1/
```

## Authentication

All API requests require authentication:
- **OAuth 2.0**: `Authorization: Bearer <token>` header
- **Session cookie**: For browser-based clients

## Versioning

API versions are URL-based: `/v1/`, `/v2/`, etc. Breaking changes introduce a new major version.

## Pagination

List endpoints use cursor-based pagination:

```json
{
  "status": "ok",
  "data": [...],
  "meta": {
    "cursor": "next_page_token",
    "has_more": true
  }
}
```

## Core Resources

| Resource   | Endpoint            | Description              |
|-----------|---------------------|--------------------------|
| Content    | `/v1/content`       | UGC media content        |
| Users      | `/v1/users`         | User profiles            |
| Auth       | `/v1/auth`          | Authentication           |
| Media      | `/v1/media`         | Upload/download          |
| Comments   | `/v1/comments`      | Content comments         |

## @zuku/sdk Package

TypeScript SDK for the zuku API. See [packages/sdk/](packages/sdk/) for details.

```bash
npm install @zuku/sdk
```

## Related Projects

- [shizuku](https://github.com/zukuapp/shizuku) — Platform documentation
- [zuku-engine-next2d](https://github.com/zukuapp/zuku-engine-next2d) — Jump game engine
- [zuku-cli](https://github.com/zukuapp/zuku-cli) — CLI tools

## License

Shizuku Open License (SOL)
