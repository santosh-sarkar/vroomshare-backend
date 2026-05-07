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
	booking_request: {
		subject: 'New Booking Request - VroomShare',
		title: 'New Booking Request',
		heading: 'You have a new booking request',
	},
	booking_approved_payment: {
		subject: 'Booking Approved - Complete Your Payment - VroomShare',
		title: 'Booking Approved',
		heading: 'Your booking has been approved',
	},
	kyc_approved: {
		subject: 'KYC Approved - VroomShare',
		title: 'KYC Approved',
		heading: 'Your identity verification was approved',
	},
	kyc_rejected: {
		subject: 'KYC Rejected - VroomShare',
		title: 'KYC Rejected',
		heading: 'Your identity verification needs attention',
	},
	vehicle_approved: {
		subject: 'Vehicle Listing Approved - VroomShare',
		title: 'Vehicle Approved',
		heading: 'Your vehicle listing is now live',
	},
	vehicle_rejected: {
		subject: 'Vehicle Listing Rejected - VroomShare',
		title: 'Vehicle Rejected',
		heading: 'Your vehicle listing needs changes',
	},
	dispute_opened: {
		subject: 'Dispute Opened - VroomShare',
		title: 'Dispute Opened',
		heading: 'A dispute has been opened for your booking',
	},
	dispute_updated: {
		subject: 'Dispute Update - VroomShare',
		title: 'Dispute Update',
		heading: 'Your dispute has a new update',
	},
};

function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function formatBookingDate(value) {
	if (!value) return 'TBD';

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'TBD';

	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	}).format(date);
}

function formatCurrency(amount) {
	const numericAmount = Number(amount);
	if (!Number.isFinite(numericAmount)) return 'NPR 0';

	return new Intl.NumberFormat('en-NP', {
		style: 'currency',
		currency: 'NPR',
		maximumFractionDigits: 0,
	}).format(numericAmount);
}

function formatLabel(value) {
	return String(value || '')
		.split(/[_\s-]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function buildInfoRows(rows) {
	return rows
		.filter((row) => row && row.label && row.value !== undefined && row.value !== null && String(row.value).trim() !== '')
		.map(
			(row) => `
				<p style="margin:0 0 10px 0; font-size:15px; color:#111827;"><strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.value)}</p>
			`,
		)
		.join('');
}

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
							<tr>
								<td style="padding: 28px 40px 0 40px;">
									<span class="logo-text" style="font-size:20px; font-weight:800; color:#111827; letter-spacing:-0.3px;">
										Vroom<span class="logo-dot" style="color:#008493;">Share</span>
									</span>
								</td>
							</tr>
							<tr>
								<td style="padding: 20px 40px 0 40px;">
									<hr class="divider" style="border:none; border-top:1px solid #e4e4e7; margin:0;">
								</td>
							</tr>
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
							<tr>
								<td style="padding: 0 40px;">
									<hr class="divider" style="border:none; border-top:1px solid #e4e4e7; margin:0;">
								</td>
							</tr>
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

function buildBookingApprovedPaymentHtml({
	userName,
	vehicleName,
	startDate,
	endDate,
	totalPrice,
	paymentUrl,
	bookingId,
}) {
	const config = EMAIL_CONFIGS.booking_approved_payment;
	const safeUserName = escapeHtml(userName || 'User');
	const safeVehicleName = escapeHtml(vehicleName || 'your vehicle');
	const safeBookingId = escapeHtml(bookingId || 'N/A');
	const safeStartDate = escapeHtml(formatBookingDate(startDate));
	const safeEndDate = escapeHtml(formatBookingDate(endDate));
	const safeTotalPrice = escapeHtml(formatCurrency(totalPrice));
	const safePaymentUrl = paymentUrl ? escapeHtml(paymentUrl) : null;

	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${config.title}</title>
		</head>
		<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; color:#111827;">
			<table width="100%" cellpadding="0" cellspacing="0" style="padding: 48px 16px;">
				<tr>
					<td align="center">
						<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background-color:#ffffff; border-radius:8px; border:1px solid #e4e4e7;">
							<tr>
								<td style="padding: 28px 40px 0 40px;">
									<span style="font-size:20px; font-weight:800; color:#111827; letter-spacing:-0.3px;">
										Vroom<span style="color:#008493;">Share</span>
									</span>
								</td>
							</tr>
							<tr>
								<td style="padding: 20px 40px 0 40px;">
									<hr style="border:none; border-top:1px solid #e4e4e7; margin:0;">
								</td>
							</tr>
							<tr>
								<td style="padding: 36px 40px 28px 40px;">
									<h1 style="font-size:22px; font-weight:700; color:#111827; margin:0 0 20px 0; line-height:1.3;">
										${config.heading}
									</h1>
									<p style="font-size:15px; color:#374151; margin:0 0 6px 0; line-height:1.6;">Hi ${safeUserName},</p>
									<p style="font-size:15px; color:#374151; margin:0 0 24px 0; line-height:1.6;">
										Your booking for <strong>${safeVehicleName}</strong> has been approved by the owner. Please complete the payment to confirm the trip.
									</p>
									<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb; border-radius:6px; border:1px solid #e5e7eb; margin-bottom:24px;">
										<tr>
											<td style="padding:24px;">
												<p style="margin:0 0 12px 0; font-size:14px; color:#6b7280; text-transform:uppercase; letter-spacing:1px;">Booking Details</p>
												<p style="margin:0 0 10px 0; font-size:15px; color:#111827;"><strong>Booking ID:</strong> ${safeBookingId}</p>
												<p style="margin:0 0 10px 0; font-size:15px; color:#111827;"><strong>Pickup Date:</strong> ${safeStartDate}</p>
												<p style="margin:0 0 10px 0; font-size:15px; color:#111827;"><strong>Return Date:</strong> ${safeEndDate}</p>
												<p style="margin:0; font-size:15px; color:#111827;"><strong>Total Amount:</strong> ${safeTotalPrice}</p>
											</td>
										</tr>
									</table>
									${safePaymentUrl ? `<p style="margin:0 0 24px 0;"><a href="${safePaymentUrl}" style="display:inline-block; background-color:#008493; color:#ffffff; text-decoration:none; padding:12px 20px; border-radius:6px; font-weight:600;">Complete Payment</a></p>` : ''}
									<p style="font-size:14px; color:#374151; margin:0 0 8px 0; line-height:1.6;">
										Complete payment as soon as possible from your VroomShare account to secure this booking.
									</p>
									<p style="font-size:14px; color:#374151; margin:0; line-height:1.6;">
										If you did not expect this booking update, please contact VroomShare support.
									</p>
								</td>
							</tr>
							<tr>
								<td style="padding: 0 40px;">
									<hr style="border:none; border-top:1px solid #e4e4e7; margin:0;">
								</td>
							</tr>
							<tr>
								<td style="padding: 20px 40px 28px 40px;">
									<p style="font-size:13px; color:#9ca3af; margin:0;">VroomShare Team</p>
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

function buildStatusNotificationHtml({
	title,
	heading,
	userName,
	message,
	details = [],
	reason,
	nextSteps,
	ctaUrl,
	ctaLabel,
	noticeTone = 'info',
}) {
	const toneStyles = {
		info: {
			background: '#eff6ff',
			border: '#bfdbfe',
			text: '#1d4ed8',
		},
		warning: {
			background: '#fff7ed',
			border: '#fdba74',
			text: '#c2410c',
		},
		success: {
			background: '#ecfdf5',
			border: '#86efac',
			text: '#15803d',
		},
	};

	const tone = toneStyles[noticeTone] || toneStyles.info;
	const safeUserName = escapeHtml(userName || 'User');
	const infoRows = buildInfoRows(details);
	const safeReason = reason && String(reason).trim() ? escapeHtml(reason) : null;
	const safeNextSteps = nextSteps && String(nextSteps).trim() ? escapeHtml(nextSteps) : null;
	const safeCtaUrl = ctaUrl && String(ctaUrl).trim() ? escapeHtml(ctaUrl) : null;
	const safeCtaLabel = ctaLabel && String(ctaLabel).trim() ? escapeHtml(ctaLabel) : 'Go to Dashboard';

	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${escapeHtml(title)}</title>
		</head>
		<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; color:#111827;">
			<table width="100%" cellpadding="0" cellspacing="0" style="padding: 48px 16px;">
				<tr>
					<td align="center">
						<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background-color:#ffffff; border-radius:8px; border:1px solid #e4e4e7;">
							<tr>
								<td style="padding: 28px 40px 0 40px;">
									<span style="font-size:20px; font-weight:800; color:#111827; letter-spacing:-0.3px;">
										Vroom<span style="color:#008493;">Share</span>
									</span>
								</td>
							</tr>
							<tr>
								<td style="padding: 20px 40px 0 40px;">
									<hr style="border:none; border-top:1px solid #e4e4e7; margin:0;">
								</td>
							</tr>
							<tr>
								<td style="padding: 36px 40px 28px 40px;">
									<h1 style="font-size:22px; font-weight:700; color:#111827; margin:0 0 20px 0; line-height:1.3;">${escapeHtml(heading)}</h1>
									<p style="font-size:15px; color:#374151; margin:0 0 6px 0; line-height:1.6;">Hi ${safeUserName},</p>
									<p style="font-size:15px; color:#374151; margin:0 0 24px 0; line-height:1.6;">${escapeHtml(message)}</p>
									${infoRows ? `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb; border-radius:6px; border:1px solid #e5e7eb; margin-bottom:24px;"><tr><td style="padding:24px;"><p style="margin:0 0 12px 0; font-size:14px; color:#6b7280; text-transform:uppercase; letter-spacing:1px;">Details</p>${infoRows}</td></tr></table>` : ''}
									${safeReason ? `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${tone.background}; border-radius:6px; border:1px solid ${tone.border}; margin-bottom:24px;"><tr><td style="padding:20px;"><p style="margin:0 0 10px 0; font-size:13px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:${tone.text};">Reason</p><p style="margin:0; font-size:15px; line-height:1.7; color:#111827;">${safeReason}</p></td></tr></table>` : ''}
									${safeNextSteps ? `<p style="font-size:14px; color:#374151; margin:0 0 8px 0; line-height:1.6;">${safeNextSteps}</p>` : ''}								${safeCtaUrl ? `<p style="margin:0 0 24px 0;"><a href="${safeCtaUrl}" style="display:inline-block;background-color:#008493;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">${safeCtaLabel}</a></p>` : ''}									<p style="font-size:14px; color:#374151; margin:0; line-height:1.6;">If you need help, reply through your VroomShare account or contact support.</p>
								</td>
							</tr>
							<tr>
								<td style="padding: 0 40px;">
									<hr style="border:none; border-top:1px solid #e4e4e7; margin:0;">
								</td>
							</tr>
							<tr>
								<td style="padding: 20px 40px 28px 40px;">
									<p style="font-size:13px; color:#9ca3af; margin:0;">VroomShare Team</p>
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

async function sendRenderedEmail(email, subject, html, logLabel) {
	const apiUrl = process.env.VERCEL_EMAIL_API_URL;
	const apiKey = process.env.VERCEL_EMAIL_API_KEY;

	if (!apiUrl) throw new Error('VERCEL_EMAIL_API_URL is not set');
	if (!apiKey) throw new Error('VERCEL_EMAIL_API_KEY is not set');

	try {
		return await sendViaVercelApi(apiUrl, email, subject, html);
	} catch (err) {
		console.error(`${logLabel} error:`, err && err.message ? err.message : err);
		throw err instanceof Error ? err : new Error(err && err.message ? err.message : String(err));
	}
}

async function sendEmail(email, code, userName, type) {
	const config = EMAIL_CONFIGS[type] || EMAIL_CONFIGS.email_verification;
	const html = buildEmailHtml(code, userName, type);

	return sendRenderedEmail(email, config.subject, html, `sendEmail [${type}]`);
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

async function sendBookingRequestEmail(email, { ownerName, renterName, vehicleName, startDate, endDate, totalPrice, platformFeeRate = 0.15, bookingId, dashboardUrl }) {
	const config = EMAIL_CONFIGS.booking_request;
	const platformFee = totalPrice * platformFeeRate;
	const netAmount = totalPrice - platformFee;
	const html = buildStatusNotificationHtml({
		title: config.title,
		heading: config.heading,
		userName: ownerName,
		message: `${renterName || 'A renter'} has requested to book your vehicle ${vehicleName || 'your vehicle'}. Please review and respond from your dashboard.`,
		details: [
			{ label: 'Booking ID', value: bookingId },
			{ label: 'Vehicle', value: vehicleName },
			{ label: 'Renter', value: renterName },
			{ label: 'Pickup Date', value: formatBookingDate(startDate) },
			{ label: 'Return Date', value: formatBookingDate(endDate) },
			{ label: 'Booking Total', value: formatCurrency(totalPrice) },
			{ label: `Platform Fee (${Math.round(platformFeeRate * 100)}%)`, value: `- ${formatCurrency(platformFee)}` },
			{ label: 'You Receive', value: formatCurrency(netAmount) },
		],
		nextSteps: dashboardUrl ? null : 'Log in to your VroomShare owner dashboard to approve or reject this request.',
		ctaUrl: dashboardUrl || null,
		ctaLabel: 'Review Booking',
		noticeTone: 'info',
	});
	return sendRenderedEmail(email, config.subject, html, 'sendBookingRequestEmail');
}

async function sendBookingApprovedPaymentEmail(email, details) {
	const html = buildBookingApprovedPaymentHtml(details);
	return sendRenderedEmail(email, EMAIL_CONFIGS.booking_approved_payment.subject, html, 'sendBookingApprovedPaymentEmail');
}

async function sendKycReviewEmail(email, { userName, status, reason, role }) {
	const configKey = status === 'approved' ? 'kyc_approved' : 'kyc_rejected';
	const config = EMAIL_CONFIGS[configKey];
	const html = buildStatusNotificationHtml({
		title: config.title,
		heading: config.heading,
		userName,
		message:
			status === 'approved'
				? `Your ${role ? `${formatLabel(role)} ` : ''}KYC submission has been approved. You can continue using verification-gated features on VroomShare.`
				: `Your ${role ? `${formatLabel(role)} ` : ''}KYC submission was rejected after review. Please review the reason below and submit corrected documents.`,
		details: [
			{ label: 'Review Status', value: formatLabel(status) },
			{ label: 'Account Type', value: role ? formatLabel(role) : 'User' },
		],
		reason,
		nextSteps:
			status === 'approved'
				? 'You do not need to take further action right now.'
				: 'Update the rejected document(s) and submit your KYC again from your account dashboard.',
		noticeTone: status === 'approved' ? 'success' : 'warning',
	});

	return sendRenderedEmail(email, config.subject, html, 'sendKycReviewEmail');
}

async function sendVehicleReviewEmail(email, { userName, status, reason, vehicleName }) {
	const configKey = status === 'approved' ? 'vehicle_approved' : 'vehicle_rejected';
	const config = EMAIL_CONFIGS[configKey];
	const html = buildStatusNotificationHtml({
		title: config.title,
		heading: config.heading,
		userName,
		message:
			status === 'approved'
				? 'Your vehicle listing has been approved and is now available for renters on VroomShare.'
				: 'Your vehicle listing was not approved. Please review the reason below and update the listing or documents before resubmitting.',
		details: [
			{ label: 'Vehicle', value: vehicleName || 'Vehicle Listing' },
			{ label: 'Review Status', value: formatLabel(status) },
		],
		reason,
		nextSteps:
			status === 'approved'
				? 'You can now manage availability and accept bookings from your owner dashboard.'
				: 'Correct the issue and submit the listing again from your owner dashboard.',
		noticeTone: status === 'approved' ? 'success' : 'warning',
	});

	return sendRenderedEmail(email, config.subject, html, 'sendVehicleReviewEmail');
}

async function sendDisputeNotificationEmail(email, { userName, status, reason, resolution, bookingId, disputeId, vehicleName }) {
	const normalizedStatus = String(status || 'updated').toLowerCase();
	const config = EMAIL_CONFIGS[normalizedStatus === 'opened' ? 'dispute_opened' : 'dispute_updated'];
	const html = buildStatusNotificationHtml({
		title: config.title,
		heading: config.heading,
		userName,
		message:
			normalizedStatus === 'opened'
				? 'A dispute has been created for a booking associated with your account. We will review the case and keep you updated.'
				: `Your dispute status is now ${formatLabel(normalizedStatus)}. Review the latest details below.`,
		details: [
			{ label: 'Dispute ID', value: disputeId },
			{ label: 'Booking ID', value: bookingId },
			{ label: 'Vehicle', value: vehicleName },
			{ label: 'Status', value: formatLabel(normalizedStatus) },
		],
		reason: resolution || reason,
		nextSteps:
			normalizedStatus === 'opened'
				? 'You may be asked for additional evidence or clarification from the admin team.'
				: 'Check your booking and dispute details in your VroomShare account for the full case history.',
		noticeTone: normalizedStatus === 'resolved' ? 'success' : normalizedStatus === 'rejected' ? 'warning' : 'info',
	});

	return sendRenderedEmail(email, config.subject, html, 'sendDisputeNotificationEmail');
}

module.exports = {
	sendVerificationEmail,
	sendPasswordResetEmail,
	sendEmailChangeEmail,
	sendBookingRequestEmail,
	sendBookingApprovedPaymentEmail,
	sendKycReviewEmail,
	sendVehicleReviewEmail,
	sendDisputeNotificationEmail,
};

