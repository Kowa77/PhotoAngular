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

// Configuración de multer para manejar la subida de archivos
const upload = multer({
    storage: multer.memoryStorage(), // Almacena el archivo en memoria
    limits: { fileSize: 25 * 1024 * 1024 } // Límite de 25MB por archivo
});

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/create_preference', async (req, res) => {
    console.log('📦 Iniciando creación de preferencia de Mercado Pago...');
    try {
        const body = {
            items: [{
                title: req.body.title,
                quantity: Number(req.body.quantity),
                unit_price: Number(req.body.price),
                currency_id: "UYU",
            }],
            back_urls: {
                success: "https://www.elpais.com.uy/",
                failure: "https://www.elpais.com.uy/",
                pending: "https://www.elpais.com.uy/"
            },
            auto_return: "approved",
        };
        const preference = new Preference(client);
        const result = await preference.create({ body });
        console.log('✅ Preferencia de Mercado Pago creada con éxito. ID:', result.id);
        res.json({ id: result.id });
    } catch (error) {
        console.error('❌ Error en la creación de preferencia:', error);
        res.status(500).json({ error: 'Error al crear la preferencia ;(' });
    }
});

// Ruta consolidada para manejar la lógica de la galería
app.get('/api/gallery/:userId', async (req, res) => {
    console.log('📦 Solicitud para cargar la galería recibida.');
    try {
        const userId = req.params.userId;
        let albumId;

        console.log(`🔎 Buscando ID de álbum para el usuario '${userId}'...`);
        const userRef = admin.database().ref('users/' + userId);
        const snapshot = await userRef.once('value');

        // --- Lógica para obtener o crear el álbum ---
        if (snapshot.exists() && snapshot.val().albumId) {
            albumId = snapshot.val().albumId;
            console.log(`✅ Álbum ID encontrado: ${albumId}`);
        } else {
            console.log('🔎 No se encontró un álbum. Creando uno nuevo...');
            const oAuth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET
            );
            oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
            const { token } = await oAuth2Client.getAccessToken();

            const albumTitle = `Fotos de ${userId}`;
            const createAlbumResponse = await axios.post(
                'https://photoslibrary.googleapis.com/v1/albums',
                { album: { title: albumTitle } },
                { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
            );
            albumId = createAlbumResponse.data.id;
            await userRef.set({ albumId: albumId });
            console.log(`✅ Álbum creado y guardado en Firebase con ID: ${albumId}`);
        }
        // --- Fin de la lógica para obtener o crear el álbum ---

        // A partir de aquí, 'albumId' SIEMPRE tendrá un valor
        console.log('⏳ Autenticando para obtener fotos...');
        const oAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
        const { token } = await oAuth2Client.getAccessToken();
        console.log('✅ Autenticación exitosa.');

        console.log(`⏳ Obteniendo la lista de fotos del álbum ${albumId}...`);
        const mediaItemsResponse = await axios.post(
            'https://photoslibrary.googleapis.com/v1/mediaItems:search',
            { albumId: albumId, pageSize: 100 },
            { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
        );
        const photos = mediaItemsResponse.data.mediaItems;

        if (!photos || photos.length === 0) {
            console.log('⚠️ No se encontraron fotos en el álbum.');
            return res.json([]);
        }

        const simplifiedPhotos = photos.map(photo => ({
            id: photo.id,
            productUrl: photo.productUrl,
            baseUrl: photo.baseUrl,
            filename: photo.filename,
            mediaMetadata: photo.mediaMetadata,
        }));
        console.log(`✅ Se encontraron ${simplifiedPhotos.length} fotos.`);
        res.json(simplifiedPhotos);

    } catch (error) {
        // Usa el manejo de errores mejorado que te di antes
        if (axios.isAxiosError(error)) {
            // ... (código para errores de Axios) ...
        } else {
            console.error('❌ Error general al cargar la galería:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }
});

// ENDPOINT PARA SUBIR FOTOS (CORREGIDO)
app.post('/api/upload-photo/:userId', upload.single('photo'), async (req, res) => {
    const userId = req.params.userId;
    const photoFile = req.file;

    if (!photoFile) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }

    try {
        console.log(`⏳ Proceso de subida de foto para el usuario: ${userId}...`);

        // 1. Obtener el albumId del usuario desde Firebase
        const userRef = admin.database().ref('users/' + userId);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        const albumId = userData?.albumId;

        if (!albumId) {
            return res.status(404).json({ error: 'No se encontró un álbum para el usuario especificado.' });
        }

        // 2. Autenticar con Google Photos API
        const oAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
        );
        oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
        const { token } = await oAuth2Client.getAccessToken();

        // 3. Subir el archivo de la foto a Google Photos (usando axios)
        console.log('⏳ Subiendo archivo a Google Photos...');
        const uploadResponse = await axios.post(
            'https://photoslibrary.googleapis.com/v1/uploads',
            photoFile.buffer,
            {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-Goog-Upload-File-Name': photoFile.originalname,
                    'X-Goog-Upload-Protocol': 'raw',
                    'Authorization': `Bearer ${token}`,
                },
            }
        );
        const uploadToken = uploadResponse.data;
        console.log('✅ Subida de archivo exitosa. Token:', uploadToken);

        // 4. Crear un nuevo MediaItem y asociarlo al álbum del usuario (usando axios)
        const mediaItemResponse = await axios.post(
            'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
            {
                albumId: albumId,
                newMediaItems: [{
                    simpleMediaItem: {
                        uploadToken: uploadToken,
                    },
                }],
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        const newMediaItem = mediaItemResponse.data.newMediaItemResults[0].mediaItem;
        console.log('✅ Foto creada en el álbum. ID:', newMediaItem.id);

        res.status(200).json({
            message: 'Foto subida y añadida al álbum correctamente.',
            photo: {
                id: newMediaItem.id,
                productUrl: newMediaItem.productUrl,
                baseUrl: newMediaItem.baseUrl
            },
        });

    } catch (error) {
        console.error('❌ Error al subir la foto:', error);
        res.status(500).json({ error: 'Error interno del servidor al subir la foto.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
