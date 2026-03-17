Vercel serverless email API
=================================

1) Example Vercel API route (put in your frontend project at `/api/send-email.js`)

```js
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Simple secret check: ensure callers supply the same `EMAIL_API_SECRET`
  const incomingKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace(/^Bearer\s+/, "");
  if (!incomingKey || incomingKey !== process.env.EMAIL_API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { to, subject, html } = req.body;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"VroomShare" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Email failed" });
  }
}
```

2) Vercel environment variables

- `EMAIL_USER` — yourgmail@gmail.com
- `EMAIL_PASS` — Gmail App Password (use App Passwords, not main password)

3) Backend (Render) configuration

- Set `VERCEL_EMAIL_API_URL` in your Render app to the full Vercel function URL, e.g.
  `https://your-vercel-project.vercel.app/api/send-email`
-- Optional: set `VERCEL_EMAIL_API_KEY` and have the Vercel API check `Authorization: Bearer <key>` for simple auth.
- Recommended: set `EMAIL_API_SECRET` on both Vercel and Render and use the `x-api-key` header to authenticate calls from your backend.

4) How the flow works

Render backend -> Vercel API (`VERCEL_EMAIL_API_URL`) -> Gmail SMTP -> Recipient inbox

Notes
- Keep the Gmail app password secret. Use Vercel dashboard to add env vars.
- This repo's backend `src/services/email.service.js` will prefer `VERCEL_EMAIL_API_URL` and fallback to nodemailer locally.
