import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import axios from 'axios';
import multer from 'multer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPathEnv) {
    console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT_PATH no está definido en el archivo .env.');
    process.exit(1);
}
const serviceAccountPath = path.join(__dirname, serviceAccountPathEnv);
const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://bsfotografia-9fc03-default-rtdb.firebaseio.com'
});

import { MercadoPagoConfig, Preference } from 'mercadopago';
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage(),
});

// Configuración del cliente OAuth2 de Google
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/oauth2callback'
);

oauth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN,
});

// Lógica de Mercado Pago
app.post('/api/create_preference', (req, res) => {
    res.status(501).json({ error: 'La funcionalidad de Mercado Pago no está implementada en este ejemplo.' });
});

// Ruta de subida de fotos
app.post('/api/upload-photos', upload.array('photos'), async (req, res) => {
    console.log('📦 Solicitud de subida de fotos recibida.');

    const { targetUserEmail } = req.body;
    const files = req.files;

    if (!targetUserEmail) {
        return res.status(400).json({ error: 'El correo electrónico del usuario es requerido.' });
    }

    if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No se encontraron archivos en la solicitud.' });
    }

    try {
        console.log(`Buscando UID para el correo: ${targetUserEmail}`);
        // 1. Obtener el UID del usuario a partir del email
        const userRecord = await admin.auth().getUserByEmail(targetUserEmail);
        const targetUserUid = userRecord.uid;
        console.log(`✅ UID encontrado: ${targetUserUid}`);

        // 2. Obtener el albumId del usuario desde la base de datos de Firebase
        const userRef = admin.database().ref('users/' + targetUserUid);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();

        if (!userData || !userData.albumId) {
            return res.status(404).json({ error: 'No se encontró un álbum de fotos para este usuario en la base de datos.' });
        }

        const albumId = userData.albumId;
        console.log(`✅ Álbum ID encontrado para el UID ${targetUserUid}: ${albumId}`);

        // 3. OBTENER UN TOKEN DE ACCESO FRESCO
        const { token } = await oauth2Client.getAccessToken();

        // 4. Subir cada archivo a Google Photos
        const uploadResults = [];
        for (const file of files) {
            console.log(`Subiendo archivo: ${file.originalname}`);
            const uploadResponse = await axios.post(
                'https://photoslibrary.googleapis.com/v1/uploads',
                file.buffer,
                {
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'X-Google-Photos-Origin': file.originalname,
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );
            const uploadToken = uploadResponse.data;
            console.log(`✅ Archivo subido exitosamente. Token: ${uploadToken}`);
            uploadResults.push({ uploadToken, filename: file.originalname });
        }

        // 5. Crear un nuevo MediaItem
        const newMediaItems = uploadResults.map(result => ({
            simpleMediaItem: {
                uploadToken: result.uploadToken,
            },
        }));

        const mediaItemResponse = await axios.post(
            'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
            {
                albumId: albumId,
                newMediaItems: newMediaItems,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        console.log('✅ Fotos creadas en el álbum. Resultados:', mediaItemResponse.data.newMediaItemResults);

        const photoResults = mediaItemResponse.data.newMediaItemResults.map(result => ({
            id: result.mediaItem.id,
            productUrl: result.mediaItem.productUrl,
            baseUrl: result.mediaItem.baseUrl
        }));

        res.status(200).json({
            message: 'Fotos subidas y añadidas al álbum correctamente.',
            photos: photoResults,
        });

    } catch (error) {
        console.error('❌ Error al subir las fotos:', error.response ? error.response.data : error.message);
        if (error.code === 'auth/user-not-found') {
            res.status(404).json({ error: 'El usuario con ese correo electrónico no existe.' });
        } else {
            res.status(500).json({ error: 'Error interno del servidor al subir las fotos.' });
        }
    }
});

// NUEVA RUTA PARA OBTENER LAS FOTOS DE UN USUARIO (SIN CAMBIOS)
app.get('/api/gallery/:userId', async (req, res) => {
    const userId = req.params.userId;
    console.log(`🖼️ Solicitud de fotos para el usuario con UID: ${userId}`);

    try {
        const userRef = admin.database().ref('users/' + userId);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();

        if (!userData || !userData.albumId) {
            return res.status(404).json({ error: 'No se encontró un álbum de fotos para este usuario.' });
        }

        const albumId = userData.albumId;
        console.log(`✅ Álbum ID encontrado para ${userId}: ${albumId}`);

        const { token } = await oauth2Client.getAccessToken();

        const photosResponse = await axios.post(
            'https://photoslibrary.googleapis.com/v1/mediaItems:search',
            {
                albumId: albumId,
                pageSize: 100,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        const photos = photosResponse.data.mediaItems;

        if (photos && photos.length > 0) {
            const simplifiedPhotos = photos.map(photo => ({
                id: photo.id,
                baseUrl: photo.baseUrl,
                productUrl: photo.productUrl,
                filename: photo.filename,
                creationTime: photo.mediaMetadata.creationTime,
            }));
            res.status(200).json(simplifiedPhotos);
        } else {
            res.status(200).json([]);
        }

    } catch (error) {
        console.error('❌ Error al obtener las fotos de la galería:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Error interno del servidor al obtener las fotos.' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de backend escuchando en http://localhost:${PORT}`);
});
