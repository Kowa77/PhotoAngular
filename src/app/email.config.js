// email.config.js
import { createTransport } from 'nodemailer';

const transporter = createTransport({
  host: 'tu_servidor_smtp.com',
  port: 587,
  secure: false,
  auth: {
    user: 'tu_direccion_de_correo@example.com',
    pass: 'tu_contraseña'
  }
});

export default transporter;
