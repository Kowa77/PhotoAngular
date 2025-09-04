// server/uploadPhoto.js
import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';

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
    const { token } = await oAuth2Client.getAccessToken();

    if (!token) {
      throw new Error('No se pudo obtener el token de acceso.');
    }
    console.log('Autenticación exitosa.');

    // 2. Leer los bytes de la imagen
    console.log(`Leyendo la imagen desde: ${PHOTO_TO_UPLOAD_PATH}`);
    const photoBytes = await fs.readFile(PHOTO_TO_UPLOAD_PATH);

    // 3. Subir los bytes de la imagen para obtener un upload token usando Axios
    console.log('Subiendo bytes de la imagen...');
    const uploadResponse = await axios.post(
      'https://photoslibrary.googleapis.com/v1/uploads',
      photoBytes,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Authorization': `Bearer ${token}`,
          'X-Goog-Upload-File-Name': path.basename(PHOTO_TO_UPLOAD_PATH),
          'X-Goog-Upload-Protocol': 'raw',
        },
      }
    );

    const uploadToken = uploadResponse.data;
    if (!uploadToken) {
        throw new Error('No se pudo obtener el upload token.');
    }
    console.log('Se obtuvo el upload token:', uploadToken);

    // 4. Usar el upload token para crear el archivo en la librería del usuario
    console.log('Creando el archivo en Google Photos...');
    const createItemResponse = await axios.post(
      'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
      {
        newMediaItems: [
          {
            description: '¡Foto de prueba subida desde mi app en Node.js!',
            simpleMediaItem: {
              uploadToken: uploadToken,
              fileName: path.basename(PHOTO_TO_UPLOAD_PATH)
            },
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const createdItem = createItemResponse.data.newMediaItemResults?.[0];
    if (createdItem?.status.message === 'Success') {
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
