import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import axios from 'axios';

// Importa el paquete de Google
import pkg from 'googleapis';
const { google } = pkg;

// *** CAMBIO AQUÍ: Importa la librería cliente dedicada de Google Photos ***
import { PhotosClient } from '@google/photos-library';

// Carga las variables de entorno
dotenv.config();

// Inicializa Firebase Admin SDK
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPathEnv) {
    console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT_PATH no está definido en el archivo .env.');
    process.exit(1);
}
const serviceAccountPath = path.join(__dirname, serviceAccountPathEnv);

// Leer el archivo de credenciales de forma asíncrona
const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://bsfotografia-9fc03-default-rtdb.firebaseio.com'
});

// SDK de Mercado Pago
import { MercadoPagoConfig, Preference } from 'mercadopago';
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/create_preference', async (req, res) => {
    console.log('📦 Iniciando creación de preferencia de Mercado Pago...');
    try {
        const body = {
            items: [
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
        const result = await preference.create({ body });
        console.log('✅ Preferencia de Mercado Pago creada con éxito. ID:', result.id);
        res.json({
            id: result.id,
        });
    } catch (error) {
        console.error('❌ Error en la creación de preferencia:', error);
        res.status(500).json({ error: 'Error al crear la preferencia ;(' });
        return;
    }
});

app.post('/api/create-album-for-user', async (req, res) => {
    console.log('📦 Solicitud para crear álbum recibida.');
    try {
        const { userId, userName } = req.body;

        if (!userId || !userName) {
            console.error('❌ Error: userId o userName faltantes en la solicitud.');
            return res.status(400).json({ error: 'userId y userName son requeridos.' });
        }

        console.log(`🔎 Buscando usuario '${userId}' en Firebase...`);
        const userRef = admin.database().ref('users/' + userId);
        const snapshot = await userRef.once('value');
        if (snapshot.exists()) {
            const albumId = snapshot.val().albumId;
            console.log(`✅ Usuario ya existe. Álbum ya asignado con ID: ${albumId}`);
            return res.status(200).json({
                message: 'Usuario ya tiene un álbum asignado.',
                albumId: albumId
            });
        }

        console.log('⏳ Autenticando con Google Photos API...');
        const credentials = {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET
        };
        const oAuth2Client = new google.auth.OAuth2(
            credentials.client_id,
            credentials.client_secret
        );
        oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
        const { token } = await oAuth2Client.getAccessToken();
        if (!token) {
            console.error('❌ Error: No se pudo obtener el token de acceso.');
            throw new Error('No se pudo obtener el token de acceso.');
        }
        console.log('✅ Token de acceso obtenido.');

        const albumTitle = `Fotos de ${userName}`;
        console.log(`⏳ Creando álbum en Google Photos con el título: "${albumTitle}"`);

        const createAlbumResponse = await axios.post(
            'https://photoslibrary.googleapis.com/v1/albums',
            {
                album: {
                    title: albumTitle
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const albumId = createAlbumResponse.data.id;
        if (!albumId) {
            console.error('❌ Error: La respuesta de la API no contiene un ID de álbum.');
            throw new Error('No se pudo crear el álbum en Google Photos.');
        }
        console.log(`✅ Álbum creado exitosamente. ID del álbum: ${albumId}`);

        console.log(`💾 Guardando el ID del álbum para el usuario '${userId}' en Firebase...`);
        await userRef.set({
            userName: userName,
            albumId: albumId
        });
        console.log('✅ Álbum asignado en Firebase con éxito.');

        res.status(201).json({
            message: 'Álbum creado y asignado exitosamente.',
            albumId: albumId
        });

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('❌ Error en la creación de álbum (AxiosError):', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
            });
        } else {
            console.error('❌ Error en la creación de álbum (Error general):', error.message);
        }
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/api/gallery/:userId', async (req, res) => {
    console.log('📦 Solicitud para cargar la galería recibida.');
    try {
        const userId = req.params.userId;
        console.log(`🔎 Buscando ID de álbum para el usuario '${userId}'...`);
        const userRef = admin.database().ref('users/' + userId);
        const snapshot = await userRef.once('value');

        if (!snapshot.exists()) {
            console.error('❌ Error: No se encontró el usuario o el álbum asociado en Firebase.');
            return res.status(404).json({ error: 'No se encontró el usuario o el álbum asociado.' });
        }

        const albumId = snapshot.val().albumId;
        console.log(`✅ Álbum ID encontrado: ${albumId}`);

        console.log('⏳ Autenticando para obtener fotos...');
        const credentials = {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET
        };
        const oAuth2Client = new google.auth.OAuth2(
            credentials.client_id,
            credentials.client_secret
        );
        oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

        // *** CAMBIO AQUÍ: Usamos el cliente de la nueva librería ***
        const photosClient = new PhotosClient({
            auth: oAuth2Client,
        });

        console.log('✅ Autenticación exitosa.');

        console.log(`⏳ Obteniendo la lista de fotos del álbum ${albumId}...`);
        const [response] = await photosClient.mediaItems.search({
            albumId: albumId,
            pageSize: 100 // Obtener hasta 100 fotos
        });

        const photos = response.mediaItems;
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
        console.error('❌ Error al cargar la galería (Error general):', error.message);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
