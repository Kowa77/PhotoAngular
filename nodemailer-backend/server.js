require('dotenv').config(); // Carga las variables de entorno desde .env al inicio

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { google } = require('googleapis'); // Importa la biblioteca cliente de Google

const app = express();
const PORT = process.env.PORT || 3001 ;

// --- Configuración de Middleware ---
app.use(cors()); // Permite solicitudes de origen cruzado desde tu frontend Angular
app.use(express.json()); // Habilita el parsing de cuerpos de solicitud JSON

// --- Configuración del Cliente OAuth2 de Google ---
// Utiliza las credenciales de tu archivo .env
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI // Debe ser http://localhost:3001/oauth2callback
);

// Variable para almacenar el refresh_token.
// En un entorno de producción, este token DEBE guardarse en una base de datos segura
// asociada a tu aplicación, no solo en una variable en memoria o un archivo .env.
let savedRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;

// Si ya tenemos un refresh_token al inicio, establecemos las credenciales para que oauth2Client
// pueda refrescar automáticamente el access_token cuando sea necesario.
if (savedRefreshToken) {
  oauth2Client.setCredentials({
    refresh_token: savedRefreshToken,
  });
}

// Escucha el evento 'tokens' para capturar el refresh_token (la primera vez)
// y los nuevos access_tokens cuando se refresquen automáticamente.
oauth2Client.on('tokens', (tokens) => {
  if (tokens.refresh_token && tokens.refresh_token !== savedRefreshToken) {
    // Si se obtiene un nuevo refresh_token (esto ocurre principalmente en la primera autenticación
    // o si el refresh_token es revocado y se vuelve a autorizar), guárdalo.
    savedRefreshToken = tokens.refresh_token;
    console.log('¡Nuevo refresh_token obtenido! Por favor, actualiza tu .env con este valor si no está ahí:');
    console.log(`GOOGLE_REFRESH_TOKEN=${savedRefreshToken}`);
    // En un entorno de producción, aquí actualizarías tu base de datos con este nuevo refresh_token.
  }
  // No necesitamos guardar el access_token; oauth2Client lo gestiona internamente
  // y lo actualiza automáticamente cuando es necesario.
  console.log('Access_token actualizado.');
});


const createTransporter = () => {
  // Si tienes el refresh_token guardado, puedes quitarlo del .env o comentarlo.
  // Ya no lo necesitaremos para esta configuración.
  // También puedes comentar las líneas de googleapis y oauth2Client si ya no las usas.

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465, // O 587 si usas TLS/STARTTLS
    secure: true, // true para puerto 465 (SSL/TLS), false para 587 (STARTTLS)
    auth: {
      user: process.env.GMAIL_USER,       // Tu correo de Gmail del .env
      pass: 'jvjj sinz jmjk cudr'          // ¡Aquí va tu contraseña de aplicación!
    }
  });
};

// --- Rutas para el flujo de autenticación OAuth 2.0 ---

/**
 * @route GET /auth/google
 * @description Inicia el proceso de autenticación de Google OAuth 2.0.
 * Redirige al usuario a la página de consentimiento de Google.
 */
app.get('/auth/google', (req, res) => {
  // Scopes necesarios para enviar correos con Gmail
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email', // Opcional: para obtener el email del usuario
  ];

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // MUY IMPORTANTE: Solicita un refresh_token para uso futuro
    scope: scopes,
    prompt: 'consent', // Muestra la pantalla de consentimiento incluso si ya se ha autorizado
                       // Útil para asegurar que el refresh_token se genere la primera vez
  });

  res.redirect(authorizationUrl);
});

/**
 * @route GET /oauth2callback
 * @description Endpoint de callback al que Google redirige después de la autenticación.
 * Intercambia el código de autorización por tokens de acceso y refresco.
 */
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code; // El código de autorización enviado por Google

  if (!code) {
    console.error('Error: No se recibió el código de autorización.');
    return res.status(400).send('No se recibió el código de autorización.');
  }

  try {
    // Intercambia el código de autorización por tokens de acceso y refresco
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens); // Establece las credenciales en el cliente OAuth2

    // El evento 'tokens' de oauth2Client ya habrá guardado el refresh_token
    // en la variable `savedRefreshToken`.
    console.log('Tokens obtenidos exitosamente.');

    // Opcional: Verifica la conexión de Nodemailer con los nuevos tokens
    const transporter = createTransporter();
    await transporter.verify();
    console.log("Nodemailer verificado con los nuevos tokens!");

    // Mensaje de éxito para el usuario en el navegador
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Autenticación Exitosa</title>
          <style>
              body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f0f2f5; margin: 0; }
              .container { text-align: center; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
              h1 { color: #28a745; }
              p { color: #333; }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>¡Autenticación de Google Exitosa!</h1>
              <p>Tu aplicación Node.js ahora está autorizada para enviar correos.</p>
              <p>Puedes cerrar esta ventana y usar tu aplicación Angular.</p>
              <p>El <strong>refresh_token</strong> se ha guardado en tu servidor.</p>
          </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error al obtener tokens de autenticación:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error de Autenticación</title>
          <style>
              body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f0f2f5; margin: 0; }
              .container { text-align: center; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
              h1 { color: #dc3545; }
              p { color: #333; }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>Error durante la autenticación de Google</h1>
              <p>Hubo un problema al procesar tu solicitud.</p>
              <p>Detalles: ${error.message}</p>
              <p>Por favor, revisa la consola del servidor para más información.</p>
          </div>
      </body>
      </html>
    `);
  }
});


// --- Ruta para enviar correo electrónico ---

/**
 * @route POST /send-email
 * @description Envía un correo electrónico utilizando Nodemailer y las credenciales OAuth 2.0.
 * Requiere que la aplicación haya sido autenticada previamente con Google.
 */
app.post('/send-email', async (req, res) => {
  const { from, to, subject, text, html, attachments } = req.body;

  // Asegúrate de que tenemos un refresh_token antes de intentar enviar
  if (!savedRefreshToken) {
    return res.status(401).json({
      error: 'Refresh token no disponible. Por favor, autentica primero la aplicación visitando /auth/google',
      details: 'La aplicación necesita autorización de Google para enviar correos. Inicia el flujo de autenticación.',
    });
  }

  // Crea el transportador con el access_token y refresh_token gestionados por googleapis
  const transporter = createTransporter();

  try {
    const info = await transporter.sendMail({
      //from: from || `"BSFotografia" <${process.env.GMAIL_USER}>`, // Remitente
      from: `${from} <"Estudio BSFotografia" <${process.env.GMAIL_USER}>>`, // Remitente
      to,          // Destinatario(s)
      subject,     // Asunto
      text,        // Cuerpo de texto plano
      html,        // Cuerpo HTML
      attachments, // Adjuntos (opcional)
      replyTo: from, // <--- ¡LA LÍNEA CLAVE PARA QUE LA RESPUESTA VAYA AL REMITENTE REAL!
    });

    console.log("Mensaje enviado: %s", info.messageId);
    console.log("URL de vista previa: %s", nodemailer.getTestMessageUrl(info));
    res.status(200).json({
      message: 'Correo enviado exitosamente',
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info)
    });
  } catch (error) {
    console.error("Error al enviar el correo:", error);
    // Errores comunes: credenciales caducadas, límites de Gmail, etc.
    res.status(500).json({
      error: 'Error al enviar el correo',
      details: error.message,
      // Podrías añadir un código específico para que el frontend reaccione
      // Por ejemplo, si el error es de autenticación, podrías sugerir re-autenticar.
      // (error.code podría ser 'EAUTH' para errores de autenticación de Nodemailer)
    });
  }
});

// --- Inicio del Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
  console.log(`\n¡PRIMER PASO DE CONFIGURACIÓN!`);
  console.log(`Para autenticar tu aplicación con Google (solo la primera vez o si revocaste el acceso):`);
  console.log(`  Visita en tu navegador: http://localhost:${PORT}/auth/google`);
  console.log(`Después de la autenticación, copia el REFRESH_TOKEN de la consola y pégalo en tu archivo .env, luego reinicia el servidor.`);
});
