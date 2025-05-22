
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import emailHelper from './helpers/emailHelper.js';

dotenv.config();

//SDK de Mercado Pago
import { MercadoPagoConfig, Preference } from 'mercadopago';
// Agregando credenciales
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

const app = express();
const PORT = process.env.PORT || 4200;

app.use(cors());
app.use(express.json());




app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/create_preference', async (req, res) => {
    try {
        const body = {
            items:[
                {
                title: req.body.title,
                quantity: Number(req.body.quantity),
                unit_price: Number(req.body.price),
                currency_id: "UYU",
                },
            ],
            back_urls: {
                success: "https://www.elpais.com.uy/",
                failure: "https://www.elpais.com.uy/",
                pending: "https://www.elpais.com.uy/"
            },
            auto_return: "approved",
        };
        const preference = new Preference(client);
        const result = await preference.create({body});
        res.json({
            id: result.id,
        });
    } catch (error) {
        console.error('Error creating preference:', error);
        res.status(500).json({ error: 'Error al crear la preferencia ;(' });
        return;
    }
});


app.post("/contacto", async (req, res) => {
  // Destructuramos las propiedades que el frontend de Angular envía (nombre, email, mensaje)
  const { nombre, email, mensaje } = req.body;
  console.log("Petición a /contacto recibida:", req.body);

  // Validar si los campos existen
  if (!nombre || !email || !mensaje) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (nombre, email, mensaje).' });
  }

  try {
    // Aquí es donde transformamos los datos del frontend para que coincidan con emailHelper.js
    // 'to': Esta será la dirección de correo a la que TÚ quieres que te lleguen los mensajes de contacto.
    const recipientEmail = 'miscu3nt4s@hotmail.com'; // <--- CAMBIA ESTO a tu propio correo para recibir los mensajes
    // 'subject': Un asunto descriptivo para el correo
    const emailSubject = `Mensaje de Contacto de ${nombre} (${email})`;
    // 'text': El cuerpo del mensaje, combinando toda la información
    const emailText = `Nombre: ${nombre}\nEmail: ${email}\nMensaje:\n${mensaje}`;

    // Llama a emailHelper con los parámetros que espera (to, subject, text)
    let info = await emailHelper(recipientEmail, emailSubject, emailText);

    res.status(200).json({ message: `Correo enviado: ${info.response}` }); // Usamos json para consistencia
  } catch (error) {
    console.error('Error al enviar el correo:', error);
    res.status(500).json({ error: 'Error al enviar el correo interno del servidor.' }); // Mensaje de error más descriptivo
  }
});

// app.post("/contacto", (req, res) => {
//   console.log("Petición a /contacto recibida:", req.body); // Agrega esto
//   res.status(200).send({ message: "Petición recibida correctamente" });
// });


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

