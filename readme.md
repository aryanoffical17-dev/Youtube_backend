# YouTube Backend

An Express and MongoDB API for user accounts, video uploads, comments, likes, playlists, subscriptions, and tweets.

## Setup

1. Install Node.js 20 or newer and MongoDB. Create a Cloudinary account for media uploads.
2. Copy `.env.example` to `.env` and set your own MongoDB, JWT, and Cloudinary values. Do not commit `.env`.
3. Install packages and start the development server:

   ```powershell
   npm ci
   npm run dev
   ```

   The API starts at `http://localhost:8000` by default. `GET /api/v1/health` is a database-independent health check.

For a non-watch production start, use `npm start`. Run the smoke tests with `npm test`.

## Environment

| Name | Purpose |
| --- | --- |
| `PORT` | HTTP port (defaults to `8000`) |
| `NODE_ENV` | Set to `production` to use secure cross-site cookies |
| `CORS_ORIGIN` | Optional comma-separated allowed frontend origins |
| `MONGO_URI` | MongoDB connection URI; the database name is `youtubeBackend` |
| `ACCESS_TOKEN_SECRET` | Secret used to sign access tokens |
| `ACCESS_TOKEN_EXPIRES_IN` | Access token lifetime, such as `15m` (defaults to `15m`) |
| `REFRESH_TOKEN_SECRET` | Secret used to sign refresh tokens |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifetime, such as `7d` (defaults to `7d`) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

## API routes

All endpoints use the `/api/v1` prefix:

- `/users` — register, login, logout, profile, tokens, and watch history
- `/videos` — publish, browse, edit, delete, and publish-status operations
- `/comments` — list and manage video comments
- `/likes` — toggle likes and list liked videos
- `/playlist` — create and manage playlists
- `/subscriptions` — subscribe and list subscribers/channels
- `/tweets` — create and manage tweets

Most endpoints require an access token, sent as an `Authorization: Bearer <token>` header or an `accessToken` cookie. If both are present, the header wins. Requests that change data (POST, PATCH, DELETE) and authenticate with the cookie alone must also send an `Origin` header listed in `CORS_ORIGIN` (this is CSRF protection); Bearer-token requests don't need it. File uploads use multipart form data.
