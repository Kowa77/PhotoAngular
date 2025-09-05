import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import axios from 'axios';
import multer from 'multer';

// Importa dotenv para la configuración local
import * as dotenv from 'dotenv';

// Carga las variables de entorno del archivo .env solo si no estamos en producción.
if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

// Configuración de Firebase Admin SDK
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let serviceAccount;

try {
    // Intenta cargar la configuración de Firebase desde una variable de entorno (para producción)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        console.log('✅ [Firebase] Configuración cargada desde variable de entorno.');
    } else {
        // Si no está en una variable de entorno, intenta leer el archivo local (para desarrollo)
        const serviceAccountPathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        if (!serviceAccountPathEnv) {
            console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT_PATH no está definido en el archivo .env.');
            process.exit(1);
        }
        const serviceAccountPath = path.join(__dirname, serviceAccountPathEnv);
        serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'));
        console.log('✅ [Firebase] Configuración cargada desde archivo local.');
    }
} catch (err) {
    console.error(`❌ Error al cargar la clave de servicio de Firebase:`, err);
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://bsfotografia-9fc03-default-rtdb.firebaseio.com'
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

// Configuración del transportador de Nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


// ---------------------------------------------
// FUNCIONES AUXILIARES PARA GOOGLE PHOTOS
// ---------------------------------------------
async function getGooglePhotosToken() {
    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
        const { token } = await auth.getAccessToken();
        return token;
    } catch (error) {
        console.error('❌ Error al obtener token de acceso:', error.message);
        throw new Error('No se pudo obtener el token de acceso de Google Photos. Revisa tus credenciales.');
    }
}

async function createAlbum(token, albumTitle) {
    try {
        const response = await axios.post(
            'https://photoslibrary.googleapis.com/v1/albums',
            { album: { title: albumTitle } },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            }
        );
        return response.data.id;
    } catch (error) {
        console.error('❌ Error al crear álbum:', error.response?.data?.error || error.message);
        return null;
    }
}

// ---------------------------------------------
// RUTA PARA SABER SI EL SERVIDOR ESTÁ ACTIVO
// ---------------------------------------------
app.get('/', (req, res) => {
    res.send('✅ Servidor de Photo-Angular está en funcionamiento.');
});

// ---------------------------------------------
// RUTA DE ENVÍO DE CORREO
// ---------------------------------------------
app.post('/api/send-email', async (req, res) => {
    console.log('➡️ [Correo] Solicitud de envío de correo recibida.');

    const { from, to, subject, text } = req.body;

    if (!from || !to || !subject || !text) {
        console.error('❌ [Correo] Faltan campos requeridos.');
        return res.status(400).json({ error: 'Faltan campos requeridos: from, to, subject, o text.' });
    }

    try {
        // Plantilla HTML para el correo.
        // Se usan estilos en línea porque muchos clientes de correo no soportan hojas de estilo externas.
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4; color: #333;">
                <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                    <h2 style="color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 10px;">Nuevo Mensaje del Formulario de Contacto</h2>

                    <p style="font-size: 16px;">👋 ¡Hola!</p>

                    <p style="font-size: 16px;">Has recibido un nuevo mensaje de tu sitio web de fotografía. Aquí están los detalles:</p>

                    <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #007bff; margin-top: 20px;">
                        <p style="margin: 0;"><strong>De:</strong> <span style="color: #555;">${from}</span></p>
                        <p style="margin: 0;"><strong>Asunto:</strong> <span style="color: #555;">${subject}</span></p>
                    </div>

                    <p style="font-size: 16px; margin-top: 20px;"><strong>Mensaje:</strong></p>
                    <div style="border: 1px solid #ddd; padding: 15px; background: #fafafa; border-radius: 5px;">
                        <p style="margin: 0; white-space: pre-wrap;">${text}</p>
                    </div>

                    <p style="font-size: 14px; color: #888; margin-top: 30px; text-align: center;">¡Que tengas un excelente día! 📸</p>
                </div>
            </div>
        `;

        // Opciones del correo
        const mailOptions = {
            from: from,
            to: to,
            subject: subject,
            text: `De: ${from}\n\nAsunto: ${subject}\n\nMensaje:\n${text}`, // Un respaldo para clientes que no muestran HTML
            html: htmlContent // El cuerpo del correo con todo el estilo
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ [Correo] Correo enviado exitosamente:', info.response);

        res.status(200).json({ message: '¡Tu mensaje se ha enviado con éxito!' });

    } catch (error) {
        console.error('❌ [Correo] Error al enviar el correo:', error);
        res.status(500).json({ error: 'Hubo un error al enviar el correo. Por favor, inténtalo de nuevo.' });
    }
});

// ---------------------------------------------
// RUTA DE REGISTRO
// ---------------------------------------------
app.post('/api/register-with-album', async (req, res) => {
    console.log('➡️ [Registro] Solicitud de registro recibida.');
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Faltan email y/o contraseña.' });
        }

        const userRecord = await admin.auth().createUser({ email, password });
        console.log(`✅ [Firebase Auth] Usuario creado. UID: ${userRecord.uid}`);

        const token = await getGooglePhotosToken();
        const albumTitle = `Fotos de ${userRecord.uid}`;
        const albumId = await createAlbum(token, albumTitle);

        if (!albumId) {
            console.error('❌ [Registro] Fallo al crear el álbum. Eliminando usuario de Firebase.');
            await admin.auth().deleteUser(userRecord.uid);
            return res.status(500).json({ error: 'Error al crear el álbum de Google Photos.' });
        }
        console.log(`✅ [Google Photos] Álbum creado con ID: ${albumId}`);

        const db = admin.database();
        await db.ref(`users/${userRecord.uid}`).set({
            email,
            albumId,
        });
        console.log(`✅ [Firebase DB] albumId guardado con éxito.`);

        res.status(201).json({ message: 'Usuario registrado y álbum creado con éxito.', userId: userRecord.uid, albumId });

    } catch (error) {
        console.error('❌ [Registro] Error en el proceso:', error.code || error.message);
        if (error.code === 'auth/email-already-in-use') {
            res.status(409).json({ error: 'El email ya está en uso.' });
        } else {
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }
});

// ---------------------------------------------
// RUTA DE GALERÍA
// ---------------------------------------------
app.get('/api/gallery/:userId', async (req, res) => {
    const { userId } = req.params;
    console.log(`➡️ [Galería] Solicitud para cargar galería de userId: ${userId}`);

    try {
        const db = admin.database();
        const snapshot = await db.ref(`users/${userId}`).once('value');
        const userData = snapshot.val();

        if (!userData || !userData.albumId) {
            console.warn('⚠️ [Galería] Usuario o ID de álbum no encontrado.');
            return res.status(404).json({ error: 'ID de álbum no encontrado para el usuario. No hay fotos en la galería.' });
        }
        const albumId = userData.albumId;

        const token = await getGooglePhotosToken();

        const photosResponse = await axios.post(
            'https://photoslibrary.googleapis.com/v1/mediaItems:search',
            { albumId, pageSize: 100 },
            { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
        );

        const photos = photosResponse.data.mediaItems || [];
        console.log(`✅ [Galería] Se encontraron ${photos.length} fotos.`);
        res.status(200).json(photos.map(p => ({ id: p.id, baseUrl: p.baseUrl, filename: p.filename })));

    } catch (error) {
        console.error('❌ [Galería] Error al cargar la galería:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al cargar la galería.' });
    }
});

// ---------------------------------------------
// RUTA DE SUBIDA DE FOTOS
// ---------------------------------------------
app.post('/api/upload-photos', upload.array('photos'), async (req, res) => {
    console.log('➡️ [Subida] Solicitud de subida de fotos recibida.');

    const { targetUserEmail } = req.body;
    const files = req.files;

    if (!targetUserEmail || !files || files.length === 0) {
        return res.status(400).json({ error: 'El correo del usuario y los archivos son requeridos.' });
    }

    try {
        const userRecord = await admin.auth().getUserByEmail(targetUserEmail);
        const snapshot = await admin.database().ref(`users/${userRecord.uid}`).once('value');
        const userData = snapshot.val();

        if (!userData || !userData.albumId) {
            return res.status(404).json({ error: 'ID de álbum no encontrado para el usuario.' });
        }
        const albumId = userData.albumId;

        const token = await getGooglePhotosToken();

        const uploadRequests = files.map(file => axios.post(
            'https://photoslibrary.googleapis.com/v1/uploads',
            file.buffer,
            { headers: { 'Content-Type': 'application/octet-stream', 'Authorization': `Bearer ${token}`, 'X-Goog-Upload-File-Name': file.originalname } }
        ));

        const uploadResponses = await Promise.all(uploadRequests);
        const newMediaItems = uploadResponses.map(res => ({ simpleMediaItem: { uploadToken: res.data } }));

        await axios.post(
            'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
            { albumId, newMediaItems },
            { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
        );

        res.status(200).json({ message: 'Fotos subidas y añadidas al álbum correctamente.' });

    } catch (error) {
        console.error('❌ [Subida] Error al subir fotos:', error.message);
        if (error.code === 'auth/user-not-found') {
            res.status(404).json({ error: 'El usuario con ese correo electrónico no existe.' });
        } else {
            res.status(500).json({ error: 'Error interno del servidor al subir las fotos.' });
        }
    }
});

// ---------------------------------------------
// RUTA DE ELIMINACIÓN DE FOTOS
// ---------------------------------------------
app.post('/api/delete-photo/:photoId', async (req, res) => {
    console.log('➡️ [Eliminación] Solicitud de eliminación de foto recibida.');

    const { photoId } = req.params;
    const { userId } = req.body;

    if (!photoId || !userId) {
        return res.status(400).json({ error: 'Falta el ID de la foto o el ID del usuario.' });
    }

    try {
        const db = admin.database();
        const snapshot = await db.ref(`users/${userId}`).once('value');
        const userData = snapshot.val();

        if (!userData || !userData.albumId) {
            console.warn('⚠️ [Eliminación] ID de álbum no encontrado para el usuario.');
            return res.status(404).json({ error: 'No se encontró el álbum de Google Photos para este usuario.' });
        }
        const albumId = userData.albumId;

        const token = await getGooglePhotosToken();

        await axios.post(
            `https://photoslibrary.googleapis.com/v1/albums/${albumId}:batchRemoveMediaItems`,
            { mediaItemIds: [photoId] },
            { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
        );

        console.log(`✅ [Eliminación] Foto ${photoId} eliminada correctamente del álbum ${albumId}.`);
        res.status(200).json({ message: 'Foto eliminada correctamente.' });
    } catch (error) {
        console.error('❌ [Eliminación] Error al eliminar la foto:', error.message);
        if (error.response && error.response.status === 404) {
            res.status(404).json({ error: 'La foto no existe o ya ha sido eliminada.' });
        } else {
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }
});

// ---------------------------------------------
// RUTA DE ESTADÍSTICAS
// ---------------------------------------------
app.get('/api/admin/photo-stats', async (req, res) => {
    try {
        const token = await getGooglePhotosToken(); // Reutiliza tu función de token
        const db = admin.database();

        // Obtener todos los usuarios de la base de datos de Firebase
        const usersSnapshot = await db.ref('users').once('value');
        const usersData = usersSnapshot.val();

        let totalPhotos = 0;

        if (usersData) {
            // Recorrer cada usuario
            for (const userId in usersData) {
                if (Object.hasOwnProperty.call(usersData, userId)) {
                    const userData = usersData[userId];
                    const albumId = userData.albumId;

                    if (albumId) {
                        let nextPageToken = null;
                        do {
                            // Usar la API de búsqueda para listar los elementos del álbum
                            const response = await axios.post(
                                'https://photoslibrary.googleapis.com/v1/mediaItems:search',
                                {
                                    albumId: albumId,
                                    pageToken: nextPageToken
                                },
                                { headers: { 'Authorization': `Bearer ${token}` } }
                            );

                            const mediaItems = response.data.mediaItems || [];
                            totalPhotos += mediaItems.length;
                            nextPageToken = response.data.nextPageToken;

                        } while (nextPageToken);
                    }
                }
            }
        }

        console.log(`✅ [Estadísticas] Se contaron ${totalPhotos} fotos en total.`);
        res.status(200).json({ totalPhotos: totalPhotos });

    } catch (error) {
        console.error('❌ [Estadísticas] Error al obtener el conteo de fotos:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al obtener estadísticas.' });
    }
});

// ---------------------------------------------
// RUTA DE CONTEO DE USUARIOS
// ---------------------------------------------
app.get('/api/admin/user-count', async (req, res) => {
    try {
        const listUsersResult = await admin.auth().listUsers();
        const totalUsers = listUsersResult.users.length;
        console.log(`✅ [Estadísticas] Se contaron ${totalUsers} usuarios en total.`);
        res.status(200).json({ totalUsers: totalUsers });
    } catch (error) {
        console.error('❌ [Estadísticas] Error al obtener el conteo de usuarios:', error.message);
        res.status(500).json({ error: 'Error interno del servidor al obtener el conteo de usuarios.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor de backend escuchando en http://localhost:${PORT}`);
});
