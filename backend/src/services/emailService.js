const nodemailer = require('nodemailer');

// Configure SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/?token=${resetToken}`;

  try {
    const info = await transporter.sendMail({
      from: `"Audio Upload App" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Återställ ditt lösenord - Audio Upload App',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1976d2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #1976d2; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 20px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎵 Audio Upload App</h1>
            </div>
            <div class="content">
              <h2>Återställ ditt lösenord</h2>
              <p>Hej!</p>
              <p>Vi fick en förfrågan om att återställa lösenordet för ditt konto. Om du inte gjort denna förfrågan kan du ignorera detta mail.</p>
              <p>Klicka på knappen nedan för att återställa ditt lösenord:</p>
              <p style="text-align: center;">
                <table cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    <td align="center" bgcolor="#1976d2" style="border-radius: 20px;">
                      <a href="${resetUrl}" target="_blank" style="font-size: 16px; font-family: Arial, sans-serif; color: #ffffff !important; text-decoration: none; padding: 12px 30px; border-radius: 20px; display: inline-block; font-weight: bold; mso-line-height-rule: exactly; -webkit-text-size-adjust: none;">
                        <font color="#ffffff"><span style="color: #ffffff !important;">Återställ lösenord</span></font>
                      </a>
                    </td>
                  </tr>
                </table>
              </p>
              <p>Eller kopiera och klistra in denna länk i din webbläsare:</p>
              <p style="word-break: break-all; color: #1976d2;">${resetUrl}</p>
              <p><strong>Länken är giltig i 1 timme.</strong></p>
            </div>
            <div class="footer">
              <p>Detta är ett automatiskt mail från Audio Upload App.</p>
              <p>Svara inte på detta mail.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log('Password reset email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

module.exports = { sendPasswordResetEmail };
