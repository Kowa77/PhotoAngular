// server/getToken.js
import { google } from 'googleapis';
import http from 'http';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Forma correcta para 2025: incluye ambos permisos
const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.appendonly',
  'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata'
];

async function main() {
  const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH));
  // The credentials for a web application are under the "web" key
  const { client_secret, client_id } = credentials.web;

  // The redirect URI must match one registered in the Google Cloud Console
  // and the port must match this server's listening port.
  const redirectUri = 'http://localhost:3000/oauth2callback';

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES.join(' ') });
  console.log('Authorize this app by visiting this url:', authUrl);

  const server = http.createServer(async (req, res) => {
    try {
      // The request URL from Google will be '/oauth2callback?code=...'
      if (req.url.startsWith('/oauth2callback')) {
        const code = new URL(req.url, 'http://localhost:3000').searchParams.get('code');
        res.end('Authentication successful! Please return to the console.');
        server.close();
        const { tokens } = await oAuth2Client.getToken(code);
        console.info('-----------------');
        console.info('¡IMPORTANTE! Copia este Refresh Token y pégalo en tu archivo .env:');
        console.info('REFRESH_TOKEN:', tokens.refresh_token);
        console.info('-----------------');
        process.exit(0);
      } else {
        // For any other request, send a 404 to prevent the browser from hanging.
        res.writeHead(404).end();
      }
    } catch (e) { console.error(e); process.exit(1); }
  }).listen(3000, () => console.log('Server listening on http://localhost:3000'));
}
main().catch(console.error);
