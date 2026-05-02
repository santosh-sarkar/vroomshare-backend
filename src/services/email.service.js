const EMAIL_CONFIGS = {
	email_verification: {
		subject: 'Verify Your Email - VroomShare',
		title: 'Verify Your Email',
		heading: 'Welcome to VroomShare!',
		description: 'Thank you for registering. Please use the verification code below to confirm your email:',
		codeLabel: 'Verification Code',
		footer: 'This code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.',
		disclaimer: "If you didn't create this account, please ignore this email.",
	},
	password_reset: {
		subject: 'Reset Your Password - VroomShare',
		title: 'Reset Your Password',
		heading: 'Password Reset Request',
		description: 'We received a request to reset your password. Use the code below to proceed:',
		codeLabel: 'Reset Code',
		footer: 'This code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.',
		disclaimer: "If you didn't request a password reset, please ignore this email.",
	},
	email_change: {
		subject: 'Confirm Email Change - VroomShare',
		title: 'Confirm Email Change',
		heading: 'Confirm Your New Email',
		description: 'You requested to change your email address. Please use the code below to confirm:',
		codeLabel: 'Confirmation Code',
		footer: 'This code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.',
		disclaimer: "If you didn't request this change, please contact our support immediately.",
	},
};

function buildEmailHtml(code, userName, type = 'email_verification') {
	const config = EMAIL_CONFIGS[type] || EMAIL_CONFIGS.email_verification;

	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${config.title}</title>
			<style>
				@media (prefers-color-scheme: dark) {
					.email-body    { background-color: #0d1117 !important; }
					.email-card    { background-color: #161b22 !important; border-color: #30363d !important; }
					.email-heading { color: #e6edf3 !important; }
					.email-text    { color: #8b949e !important; }
					.email-subtext { color: #6e7681 !important; }
					.otp-box       { background-color: #21262d !important; border-color: #30363d !important; }
					.otp-label     { color: #8b949e !important; }
					.otp-code      { color: #e6edf3 !important; }
					.notice-box    { background-color: #1f1a14 !important; border-color: #ff6b00 !important; }
					.notice-text   { color: #d4a27a !important; }
					.divider       { border-color: #30363d !important; }
					.logo-text     { color: #e6edf3 !important; }
					.logo-dot      { color: #ff6b00 !important; }
				}
			</style>
		</head>
		<body class="email-body" style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
			<table width="100%" cellpadding="0" cellspacing="0" style="padding: 48px 16px;">
				<tr>
					<td align="center">
						<table class="email-card" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background-color:#ffffff; border-radius:8px; border:1px solid #e4e4e7;">

							<!-- Logo bar -->
							<tr>
								<td style="padding: 28px 40px 0 40px;">
									<span class="logo-text" style="font-size:20px; font-weight:800; color:#111827; letter-spacing:-0.3px;">
										Vroom<span class="logo-dot" style="color:#008493;">Share</span>
									</span>
								</td>
							</tr>

							<!-- Divider under logo -->
							<tr>
								<td style="padding: 20px 40px 0 40px;">
									<hr class="divider" style="border:none; border-top:1px solid #e4e4e7; margin:0;">
								</td>
							</tr>

							<!-- Body -->
							<tr>
								<td style="padding: 36px 40px 28px 40px;">
									<h1 class="email-heading" style="font-size:22px; font-weight:700; color:#111827; margin:0 0 20px 0; line-height:1.3;">
										${config.heading}
									</h1>
									<p class="email-text" style="font-size:15px; color:#374151; margin:0 0 6px 0; line-height:1.6;">
										Hi ${userName},
									</p>
									<p class="email-text" style="font-size:15px; color:#374151; margin:0 0 28px 0; line-height:1.6;">
										${config.description}
									</p>

									<!-- OTP Box -->
									<table class="otp-box" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; border-radius:6px; border:1px solid #e4e4e7; margin-bottom:28px;">
										<tr>
											<td style="padding: 28px 20px; text-align:center;">
												<p class="otp-label" style="font-size:12px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; color:#6b7280; margin:0 0 12px 0;">${config.codeLabel}</p>
												<span class="otp-code" style="font-size:38px; font-weight:700; letter-spacing:10px; color:#111827; font-variant-numeric:tabular-nums;">${code}</span>
											</td>
										</tr>
									</table>

									<p class="email-text" style="font-size:14px; color:#374151; margin:0 0 8px 0; line-height:1.6;">
										${config.footer}
									</p>
									<p class="email-text" style="font-size:14px; color:#374151; margin:0; line-height:1.6;">
										${config.disclaimer}
									</p>
								</td>
							</tr>

							<!-- Divider -->
							<tr>
								<td style="padding: 0 40px;">
									<hr class="divider" style="border:none; border-top:1px solid #e4e4e7; margin:0;">
								</td>
							</tr>

							<!-- Footer -->
							<tr>
								<td style="padding: 20px 40px 28px 40px;">
									<p class="email-subtext" style="font-size:13px; color:#9ca3af; margin:0;">
										VroomShare Team
									</p>
								</td>
							</tr>

						</table>
					</td>
				</tr>
			</table>
		</body>
		</html>
	`;
}


async function sendViaVercelApi(apiUrl, to, subject, html) {
	const apiKey = process.env.VERCEL_EMAIL_API_KEY;
	if (!apiKey) {
		throw new Error('VERCEL_EMAIL_API_KEY is not set');
	}
	
	const response = await fetch(apiUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
		},
		body: JSON.stringify({ to, subject, html }),
	});

	const data = await response.json();

	if (!response.ok) {
		throw new Error(`Vercel email API error (${response.status}): ${data.error || 'Unknown error'}`);
	}

	return { success: true, message: 'Email sent via Vercel API', info: data };
}

async function sendEmail(email, code, userName, type) {
	const apiUrl = process.env.VERCEL_EMAIL_API_URL;
	const apiKey = process.env.VERCEL_EMAIL_API_KEY;

	if (!apiUrl) throw new Error('VERCEL_EMAIL_API_URL is not set');
	if (!apiKey) throw new Error('VERCEL_EMAIL_API_KEY is not set');

	const config = EMAIL_CONFIGS[type] || EMAIL_CONFIGS.email_verification;
	const html = buildEmailHtml(code, userName, type);

	try {
		return await sendViaVercelApi(apiUrl, email, config.subject, html);
	} catch (err) {
		console.error(`sendEmail [${type}] error:`, err && err.message ? err.message : err);
		throw err instanceof Error ? err : new Error(err && err.message ? err.message : String(err));
	}
}

async function sendVerificationEmail(email, code, userName) {
	return sendEmail(email, code, userName, 'email_verification');
}

async function sendPasswordResetEmail(email, code, userName) {
	return sendEmail(email, code, userName, 'password_reset');
}

async function sendEmailChangeEmail(email, code, userName) {
	return sendEmail(email, code, userName, 'email_change');
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendEmailChangeEmail };

