const subject = 'Verify Your Email - VroomShare';

function buildEmailHtml(verificationCode, userName) {
	return `
		<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
			<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
				<h1 style="color: white; margin: 0;">VroomShare</h1>
			</div>
			<div style="padding: 30px; background-color: #f9f9f9;">
				<h2 style="color: #333;">Hello ${userName},</h2>
				<p style="color: #666; font-size: 16px;">Please use the following OTP to verify your email:</p>
				<div style="background-color: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
					<span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea;">${verificationCode}</span>
				</div>
				<p style="color: #666; font-size: 14px;">This OTP will expire in <strong>10 minutes</strong>.</p>
			</div>
		</div>
	`;
}


async function sendViaVercelApi(apiUrl, to, html) {
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

	return { success: true, message: 'Verification email sent via Vercel API', info: data };
}

async function sendVerificationEmail(email, verificationCode, userName) {
	const apiUrl = process.env.VERCEL_EMAIL_API_URL;
	const apiKey = process.env.VERCEL_EMAIL_API_KEY;

	if (!apiUrl) throw new Error('VERCEL_EMAIL_API_URL is not set');
	if (!apiKey) throw new Error('VERCEL_EMAIL_API_KEY is not set');

	const html = buildEmailHtml(verificationCode, userName);

	try {
		return await sendViaVercelApi(apiUrl, email, html);
	} catch (err) {
		console.error('sendVerificationEmail error:', err && err.message ? err.message : err);
		throw err instanceof Error ? err : new Error(err && err.message ? err.message : String(err));
	}
}

module.exports = { sendVerificationEmail };

