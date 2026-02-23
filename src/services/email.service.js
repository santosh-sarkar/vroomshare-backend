const nodemailer = require("nodemailer");

// Create transporter - configure with your email provider
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send verification code to email
 */
async function sendVerificationEmail(email, verificationCode, userName = "User") {
    console.log(process.env.EMAIL_USER)
    console.log(process.env.EMAIL_PASSWORD)
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: "VroomShare - Email Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2>Welcome to VroomShare!</h2>
          <p>Hi ${userName},</p>
          <p>Thank you for registering. Please use the verification code below to confirm your email:</p>
          
          <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px; text-align: center;">
            <h1 style="letter-spacing: 5px; color: #333;">${verificationCode}</h1>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This code is valid for 10 minutes. Do not share this code with anyone.
          </p>
          
          <p>If you didn't create this account, please ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">VroomShare Team</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: "Verification email sent successfully" };
  } catch (err) {
    console.error("Email sending error:", err);
    throw new Error(`Failed to send verification email: ${err.message}`);
  }
}

module.exports = { sendVerificationEmail };
