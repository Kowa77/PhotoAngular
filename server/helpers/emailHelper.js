import nodemailer from 'nodemailer';
import dotenv from 'dotenv'; // Add dotenv import if you plan to use .env variables here
dotenv.config(); // Load environment variables if needed for user/pass

const emailHelper = async (to, subject, text) => {
  // Create a transporter
  let transporter = nodemailer.createTransport({
    host: "smtp.office365.com", // Servidor SMTP de Outlook/Hotmail
    port: 587, // Puerto para TLS
    secure: false, // Usar TLS, pero no SSL directo (STARTTLS)
    auth: {
      user: process.env.EMAIL_USER, // Tu dirección de correo de Hotmail (considera usar )
      pass: process.env.EMAIL_PASS, // Tu contraseña de Hotmail (considera usar process.env.EMAIL_PASS)
    },
    tls: {
      ciphers: 'TLSv1.2', // Forzar TLS 1.2
      rejectUnauthorized: true // Verificar el certificado del servidor
    }
  });

  // Set up email options
  let mailOptions = {
    from: process.env.EMAIL_USER, // Tu dirección de correo de Hotmail (considera usar process.env.EMAIL_USER)
    to: to, // Este 'to' viene del primer parámetro de emailHelper (que será tu correo de destino)
    subject: subject,
    text: text,
    // Puedes agregar una versión HTML si quieres un correo más bonito
    // html: `<p>${text.replace(/\n/g, '<br>')}</p>`,
  };

  // Send the email
  try {
    let info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

export default emailHelper;
