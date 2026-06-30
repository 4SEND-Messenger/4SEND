# 4SEND — Messenger

A messenger that requires only a username and password. No phone number. No email. No identity.

**Live:** https://4send-messenger.hf.space

---

## Why

Every "secure" messenger asks for your phone number. But a phone number is your real identity — tied to your passport, your carrier, your location. We removed that dependency entirely.

4SEND knows nothing about you except your username. That is by design.

---

## Features

- Anonymous registration — username and password only
- End-to-end encryption — server stores encrypted blobs, keys never leave the client
- No IP logging, no connection logs
- Auto-delete messages with a timer
- EXIF metadata stripped from all uploaded images
- File integrity validation on transfer
- Screenshot detection (Linux, Android)
- Voice messages, video messages, P2P calls
- Groups and channels
- Multiple accounts on one device
- Works on Web, Android (APK), iOS (PWA), Windows

All features are free. No subscription, no limits.

---

## Stack

- **Backend:** Node.js, Express, Socket.IO, MongoDB, Mongoose
- **Auth:** JWT, bcryptjs
- **Media:** Cloudinary, Sharp (EXIF stripping, image processing)
- **Push:** Firebase Admin
- **Rate limiting:** express-rate-limit
- **Sessions:** express-session + connect-mongo

---

## Security notes

- JWT verified on every Socket.IO connection — no unauthenticated sockets
- `sender` is always set server-side from the verified JWT — clients cannot spoof it
- NoSQL injection protection — recursive input sanitization on all REST and Socket events
- File uploads validated by magic bytes (file signature), not just extension
- Link preview protected against SSRF — private IP ranges blocked, redirects disabled, strict timeouts
- Rate limiting bound to `username`, not IP — prevents bypass via reconnects
- Disappearing messages use both `setTimeout` and a MongoDB TTL index as fallback
- Encryption is fail-closed — if key validation fails on startup, server does not start

---

## Environment variables

The server reads all secrets from environment variables. Never hardcode them.

```
MONGO_URI=
JWT_SECRET=
ENCRYPTION_KEY=        # 32 bytes as 64 hex chars
SECURE_SALT=
SESSION_SECRET=

CLOUDINARY_NAME=
CLOUDINARY_KEY=
CLOUDINARY_SECRET=

FIREBASE_SERVICE_ACCOUNT=   # JSON string of service account
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
FIREBASE_VAPID_KEY=

GEMINI_API_KEY=
GEMINI_API_KEY_TWO=
GEMINI_API_KEY_THREE=
```

---

## Running locally

```bash
npm install
node server.js
```

Set all environment variables before starting. The server will throw on startup if `ENCRYPTION_KEY` is missing or invalid.

---

## Platform support

| Platform | Type | Notes |
|----------|------|-------|
| Web | PWA | Any browser |
| Android | APK | Direct install |
| iOS | PWA | Install via Safari |
| Windows | Electron | .exe |

---

## License

ISC

---

## Privacy policy

Available at `/privacy.html` — 50 points covering data collection, encryption architecture, zero-knowledge design, and legal requests.

Key points: no IP storage, no connection logs, no contact sync, physical file deletion on message delete, Zero-Knowledge architecture (we cannot reset your password because we do not hold your keys).
