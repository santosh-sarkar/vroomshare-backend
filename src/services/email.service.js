const nodemailer = require('nodemailer');

async function sendVerificationEmail(email, verificationCode, userName = 'User') {
	const user = process.env.EMAIL_USER;
	const pass = process.env.EMAIL_PASSWORD;
	if (!user || !pass) {
		const msg = 'Email SMTP not configured (EMAIL_USER and EMAIL_PASS required)';
		console.error(msg);
		throw new Error(msg);
	}

	const subject = 'Verify Your Email - VroomShare';
	const html = `
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

	try {
		const transporter = nodemailer.createTransport({
			service: process.env.EMAIL_SERVICE,
			auth: { user, pass },
		});

		const info = await transporter.sendMail({
			from: user,
			to: email,
			subject,
			html,
		});

		// Verify nodemailer accepted recipients
		const accepted = Array.isArray(info.accepted) ? info.accepted : [];
		if (accepted.length === 0) {
			const msg = 'Email was not accepted by SMTP server';
			console.error('sendVerificationEmail:', msg, { accepted, rejected: info.rejected, response: info.response });
			throw new Error(msg);
		}

		return { success: true, message: 'Verification email sent via SMTP', info: { accepted, rejected: info.rejected, response: info.response, messageId: info.messageId } };
	} catch (err) {
		console.error('sendVerificationEmail error:', err && err.message ? err.message : err);
		throw err instanceof Error ? err : new Error(err && err.message ? err.message : String(err));
	}
}

module.exports = { sendVerificationEmail };

