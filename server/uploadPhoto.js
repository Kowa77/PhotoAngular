// server/uploadPhoto.js
import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// --- Configuración ---
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const PHOTO_TO_UPLOAD_PATH = path.join(__dirname, 'test-image.jpg'); // Asegúrate de que esta imagen exista
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

if (!REFRESH_TOKEN) {
  console.error('Error: REFRESH_TOKEN no encontrado. Por favor, agrégalo a tu archivo .env.');
  process.exit(1);
}

// --- Función Principal de Subida ---
async function uploadPhoto() {
  try {
    // 1. Autenticar y obtener un token de acceso
    console.log('Autenticando...');
    const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH));
    const { client_secret, client_id } = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret);

    oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

    // This is the corrected line
    const photoslibrary = google.photoslibrary({
      version: 'v1',
      auth: oAuth2Client,
    });
    console.log('Autenticación exitosa.');

    // 2. Subir los bytes de la imagen para obtener un upload token
    console.log(`Subiendo bytes de la imagen desde: ${PHOTO_TO_UPLOAD_PATH}`);
    const { data: uploadToken } = await photoslibrary.uploads.upload({
      requestBody: fs.createReadStream(PHOTO_TO_UPLOAD_PATH),
      // El nombre del archivo que se usará en Google Photos.
      'x-goog-upload-file-name': path.basename(PHOTO_TO_UPLOAD_PATH),
      'x-goog-upload-protocol': 'raw',
    });

    if (!uploadToken) {
        throw new Error('No se pudo obtener el upload token.');
    }
    console.log('Se obtuvo el upload token:', uploadToken);

    // 3. Usar el upload token para crear el archivo en la librería del usuario
    console.log('Creando el archivo en Google Photos...');
    const { data: newMediaItem } = await photoslibrary.mediaItems.batchCreate({
      requestBody: {
        newItems: [
          {
            description: '¡Foto de prueba subida desde mi app en Node.js!',
            simpleMediaItem: {
              uploadToken: uploadToken,
              fileName: path.basename(PHOTO_TO_UPLOAD_PATH)
            },
          },
        ],
      },
    });

    const createdItem = newMediaItem.newMediaItemResults?.[0];
    if (createdItem?.status.message === 'OK') {
      console.log('✅ ¡Foto subida exitosamente!');
      console.log('ID del Media Item:', createdItem.mediaItem.id);
      console.log('Puedes verla aquí:', createdItem.mediaItem.productUrl);
    } else {
      console.error('❌ Error al crear el media item:');
      console.error(createdItem?.status);
    }

  } catch (error) {
    console.error('❌ Ocurrió un error durante el proceso de subida:');
    if (error.response?.data?.error) {
        console.error(error.response.data.error);
    } else {
        console.error(error);
    }
    process.exit(1);
  }
}

uploadPhoto();
