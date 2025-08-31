// server/testToken.js
import { google } from 'googleapis';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';

// Carga las variables de entorno para el REFRESH_TOKEN
import dotenv from 'dotenv';
dotenv.config();

// Obtiene la ruta al archivo credentials.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

async function createTestAlbum() {
    try {
        if (!REFRESH_TOKEN) {
            throw new Error('❌ Error: REFRESH_TOKEN no está definido en el archivo .env.');
        }

        // Lee las credenciales directamente del archivo JSON
        const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH, 'utf8'));
        const { client_secret, client_id } = credentials.web;

        console.log('⏳ Autenticando con Google Photos API...');
        const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret
        );
        oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

        const { token } = await oAuth2Client.getAccessToken();

        if (!token) {
            throw new Error('No se pudo obtener el token de acceso.');
        }

        console.log('✅ Token de acceso obtenido.');

        const albumTitle = `Album de Prueba - ${new Date().toLocaleString()}`;
        console.log(`⏳ Creando álbum en Google Photos con el título: "${albumTitle}"`);

        const createAlbumResponse = await axios.post(
            'https://photoslibrary.googleapis.com/v1/albums',
            { album: { title: albumTitle } },
            { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
        );

        console.log('✅ Álbum creado con éxito!');
        console.log('ID del Álbum:', createAlbumResponse.data.id);

    } catch (error) {
        console.error('❌ Ocurrió un error:');
        if (axios.isAxiosError(error)) {
            console.error('Status:', error.response?.status);
            console.error('Mensaje de error de la API:', error.response?.data?.error?.message);
            console.error('Detalles:', error.response?.data?.error);
        } else {
            console.error('Error:', error.message);
        }
    }
}

createTestAlbum();
