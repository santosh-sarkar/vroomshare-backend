# VroomShare Backend (scaffold)

Basic Express + Mongoose scaffold for the VroomShare backend.

Setup

1. Copy `.env.example` to `.env` and adjust values.
2. Install dependencies:

```bash
npm install
```

3. Run in development:

```bash
npm run dev
```

Email sending (Render)

If your backend is hosted on Render (which blocks outbound SMTP), use a Vercel serverless function to send email via Gmail SMTP. See [docs/VERCEL_SEND_EMAIL.md](docs/VERCEL_SEND_EMAIL.md) for details.
