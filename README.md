# 4SEND — Messenger

Бесплатный и защищённый мессенджер с шифрованием данных. Чаты, передача файлов,
секретные чаты с сквозным шифрованием (Signal-протокол), папки, горячие клавиши,
обширная кастомизация и локализация на 20 языков.

> Версия: **2.0.0**

## Возможности

- 💬 Личные и групповые чаты, комнаты
- 🔒 Секретные чаты с E2EE (протокол Signal)
- 📁 Папки для организации чатов
- 📦 Отправка файлов через клиент (P2P)
- 🌐 Локализация на 20 языков (русский, английский, испанский, китайский, арабский,
  португальянский, хинди, украинский, казахский, польский, узбекский, чешский,
  белорусский, немецкий, французский, итальянский, японский, корейский, турецкий, персидский)
- 🎨 Обширная кастомизация интерфейса
- ⌨️ Горячие клавиши
- 🗄 Экспорт данных и шифрование базы данных при хранении
- 🔔 Push-уведомления (Firebase Cloud Messaging / Web Push)
- 🛠 Мониторинг кэша, горячие клавиши, расширенные настройки приватности

## Технологии

- **Backend:** Node.js, Express, Socket.IO, MongoDB (Mongoose)
- **Frontend:** React 19 + TypeScript + Vite
- **Шифрование:** libsodium (libsodium-wrappers), Firebase Admin
- **Сборка/деплой:** Docker (node:20-alpine)

## Структура проекта

```
4SEND/
├── index.js              # точка входа: HTTP-сервер + Socket.IO + инициализация БД
├── app.js                # Express-приложение, middleware, подключение роутов
├── package.json          # зависимости и скрипты бэкенда
├── Dockerfile            # образ для деплоя
├── config/               # загрузка секретов (JWT_SECRET, ENCRYPTION_KEY, SESSION_SECRET)
├── constants/            # константы (PORT, MONGO_URI, допустимые расширения)
├── models/               # Mongoose-модели
├── routes/               # роуты (auth, users, chats, rooms, admin, upload, settings, root)
├── services/             # сервисы (миграции, firebase и т.д.)
├── socket/               # обработчики Socket.IO
├── jobs/                 # фоновые задачи (автоудаление, очистка сессий, срок сообщений)
├── middleware/           # sanitize, безопасность, botDetection, приватность
├── utils/
├── public/               # React-клиент (Vite)
│   ├── index.html
│   ├── src/              # исходники React (App.tsx, main.tsx, …)
│   ├── public/           # статические ассеты (языки, иконки) — отдаются как есть
│   ├── vite.config.ts
│   └── package.json
└── uploads/              # загрузки пользователей (создаётся в рантайме, в .gitignore)
```

## Требования

- Node.js 20+
- MongoDB (локально или в облаке, например MongoDB Atlas)
- Аккаунт Firebase (опционально, для push-уведомлений)
- Аккаунт Cloudinary (опционально, для хранения медиа)

## Установка и запуск

### 1. Бэкенд

```bash
npm install
cp .env.example .env   # затем заполните значения
```

Обязательно задайте в `.env`:

| Переменная | Назначение |
|---|---|
| `MONGO_URI` | строка подключения к MongoDB |
| `JWT_SECRET` | секрет для подписи JWT (любая длинная случайная строка) |
| `ENCRYPTION_KEY` | 32 байта в hex (ровно 64 шестнадцатеричных символа) для шифрования БД |

### 2. Клиент (React)

Клиент живёт в папке `public/`. Его нужно собрать, чтобы сервер отдавал готовый
фронтенд из `public/` (после сборки результат появляется в `public/dist/`):

```bash
cd public
npm install
npm run build
```

### 3. Запуск

```bash
# из корня проекта
npm start
```

Сервер слушает порт `PORT` (по умолчанию `7860`) и отдаёт собранный клиент из `public/`.

### Режим разработки

```bash
# терминал 1 — бэкенд
npm start

# терминал 2 — клиент (Vite dev-сервер с hot-reload)
cd public
npm run dev
```

## Переменные окружения

| Переменная | Обязательная | Описание |
|---|---|---|
| `MONGO_URI` | ✅ | Подключение к MongoDB |
| `JWT_SECRET` | ✅ | Секрет подписи JWT |
| `ENCRYPTION_KEY` | ✅ | 64 hex-символа (32 байта) для шифрования БД |
| `PORT` | ❌ | Порт (по умолчанию `7860`) |
| `NODE_ENV` | ❌ | `production` рекомендуется в бою |
| `SESSION_SECRET` | ❌ | Секрет сессий (иначе генерируется случайно) |
| `SECURE_SALT` | ❌ | Соль для доп. шифрования |
| `REPORT_RECIPIENT` | ❌ | Ник пользователя, принимающего отчёты об ошибках |
| `FIREBASE_*` | ❌ | Конфиг Firebase (Web Push / FCM) |
| `CLOUDINARY_*` | ❌ | Хранение медиа в Cloudinary |
| `GEMINI_API_KEY*` / `AI_AGENT` | ❌ | AI-функции (Gemini) |

Полный список с описанием — в `.env.example`.

### Настройка Firebase

1. Создайте проект в Firebase Console, добавьте Web-приложение.
2. Скопируйте поля `apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId` в соответствующие `FIREBASE_*`.
3. В **Cloud Messaging → Web Push certificates** сгенерируйте VAPID-ключ → `FIREBASE_VAPID_KEY`.
4. В **Service accounts → Generate new private key** скачайте JSON → весь его текст
   вставьте в `FIREBASE_SERVICE_ACCOUNT`.

## Docker

```bash
# сначала соберите клиент (см. шаг 2 выше), затем:
docker build -t 4send .
docker run -p 7860:7860 --env-file .env 4send
```

Образ собирает только зависимости бэкенда, поэтому клиент должен быть
предварительно собран (`npm run build` в `public/`).

## Лицензия

ISC © 4SEND Team
