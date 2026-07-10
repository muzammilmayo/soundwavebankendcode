const nodemailer = require("nodemailer");

const transporter = (process.env.SMTP_USER && process.env.SMTP_PASSWORD)
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  : { sendMail: async () => console.log("Dummy transporter: Email not sent (missing SMTP credentials)") };


const sendResetEmail = async (email, resetLink) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "SoundWave - Reset Password",
      html: `
        <h2>Reset Your Password</h2>

        <p>Click the button below to reset your password.</p>

        <a href="${resetLink}"
        style="
        background:#1DB954;
        color:white;
        padding:12px 20px;
        text-decoration:none;
        border-radius:5px;
        ">
        Reset Password
        </a>

        <p>This link will expire in 15 minutes.</p>
      `,
    });
  } catch (err) {
    console.warn("Failed to send reset email:", err.message);
    // Continue without throwing – the client will still get a success response
  }
};

// New welcome email for newly created admin accounts
const sendWelcomeEmail = async (email, username, password) => {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: 'SoundWave - Your Account Details',
    html: `
      <h2>Welcome to SoundWave</h2>
      <p>Hi ${username},</p>
      <p>Your administrator account has been created. Below are your login credentials:</p>
      <ul>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Password:</strong> ${password}</li>
      </ul>
      <p>Please keep this information secure. You can log in at <a href="${process.env.CLIENT_URL}/login">${process.env.CLIENT_URL}/login</a>.</p>
    `,
  });
};

module.exports = { sendResetEmail, sendWelcomeEmail };