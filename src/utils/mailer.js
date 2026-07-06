const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const sendResetEmail = async (email, resetLink) => {
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
};

module.exports = sendResetEmail;