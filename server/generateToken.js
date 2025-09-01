import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Este es el scope que necesitas para leer y crear álbumes y fotos
const SCOPES = ['https://www.googleapis.com/auth/photoslibrary'];

async function getAuthClient() {
  const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH));

  const { client_secret, client_id } = credentials.web;
  // Utiliza el primer redirect_uri del array
  // const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');
  return oAuth2Client;
}

async function main() {
  const oAuth2Client = await getAuthClient();

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Autoriza esta app visitando la siguiente URL:');
  console.log(authUrl);

  // Crea una interfaz para leer la entrada del usuario en la terminal
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Espera a que el usuario pegue el código de autorización
  const code = await new Promise(resolve => {
    rl.question('Ingresa el código que te da Google en la URL de redirección: ', resolve);
  });
  rl.close();

  try {
    // Intercambia el código por tokens de acceso y refresco
    const { tokens } = await oAuth2Client.getToken(code);

    console.info('-----------------');
    console.info('¡IMPORTANTE! Copia este Refresh Token y pégalo en tu archivo .env:');
    console.info('REFRESH_TOKEN:', tokens.refresh_token);
    console.info('-----------------');
  } catch (error) {
    console.error('❌ Error al obtener el token:', error.message);
  }
}

main().catch(console.error);
