// functions/index.js
import admin from "firebase-admin";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import axios from "axios";
import multer from "multer";

// Firebase Functions V2
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";

// ---------------- SECRETS ----------------
const EMAIL_HOST = defineSecret("EMAIL_HOST");
const EMAIL_PORT = defineSecret("EMAIL_PORT");
const EMAIL_USER = defineSecret("EMAIL_USER");
const EMAIL_PASS = defineSecret("EMAIL_PASS");
const GOOGLE_CLIENT_ID = defineSecret("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = defineSecret("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = defineSecret("GOOGLE_REFRESH_TOKEN");

// ---------------- FIREBASE INIT ----------------
try {
  admin.initializeApp();
} catch (error) {
  if (error.code !== "app/duplicate-app") throw error;
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer: para uploads en memoria
const upload = multer({ storage: multer.memoryStorage() });

// ---------------- HELPERS ----------------
async function getGooglePhotosToken() {
  const auth = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID.value(),
    GOOGLE_CLIENT_SECRET.value()
  );
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN.value() });
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("No se pudo obtener token de Google Photos");
  return token;
}

async function createAlbum(token, albumTitle) {
  try {
    const response = await axios.post(
      "https://photoslibrary.googleapis.com/v1/albums",
      { album: { title: albumTitle } },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.id;
  } catch (err) {
    logger.error("❌ Error al crear álbum:", err.response?.data || err.message);
    return null;
  }
}


// 📊 Estadísticas de fotos (reales desde Google Photos)
app.get("/admin/photo-stats", async (req, res) => {
  try {
    const snapshot = await admin.database().ref("users").once("value");
    const users = snapshot.val() || {};

    const token = await getGooglePhotosToken();

    let totalPhotos = 0;
    let usersWithAlbums = 0;

    for (const userId of Object.keys(users)) {
      const albumId = users[userId]?.albumId;
      if (!albumId) continue;

      usersWithAlbums++;

      try {
        // Llamada a Google Photos para contar fotos en el álbum
        const photosResponse = await axios.post(
          "https://photoslibrary.googleapis.com/v1/mediaItems:search",
          { albumId, pageSize: 100 },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const items = photosResponse.data.mediaItems || [];
        totalPhotos += items.length;

        // ⚠️ Paginación: si hay más de 100 fotos, seguir llamando
        let nextPageToken = photosResponse.data.nextPageToken;
        while (nextPageToken) {
          const nextResponse = await axios.post(
            "https://photoslibrary.googleapis.com/v1/mediaItems:search",
            { albumId, pageSize: 100, pageToken: nextPageToken },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const nextItems = nextResponse.data.mediaItems || [];
          totalPhotos += nextItems.length;

          nextPageToken = nextResponse.data.nextPageToken;
        }
      } catch (err) {
        if (err.response?.status === 403) {
          // 🚨 Google restringe fotos si el álbum no fue creado por tu app
          logger.warn(`⚠️ No se puede listar fotos del álbum ${albumId}`);
        } else {
          logger.error("❌ Error obteniendo fotos:", err.message);
        }
      }
    }

    res.json({ totalPhotos, usersWithAlbums });
  } catch (error) {
    logger.error("❌ Error en /admin/photo-stats:", error.message);
    res.status(500).json({ error: "Error al obtener estadísticas de fotos" });
  }
});

// ✅ Versión compatible con tu front actual (devuelve { totalUsers })
app.get("/admin/user-count", async (req, res) => {
  try {
    let nextPageToken = undefined;
    let totalUsers = 0;

    do {
      const { users, pageToken } = await admin.auth().listUsers(1000, nextPageToken);
      totalUsers += users.length;
      nextPageToken = pageToken;
    } while (nextPageToken);

    res.status(200).json({ totalUsers });
  } catch (error) {
    logger.error("❌ Error en /admin/user-count:", error.message);
    res.status(500).json({ error: "Error al obtener cantidad de usuarios" });
  }
});





// ---------------- RUTAS API ----------------

// 📧 ENVIAR CORREO
app.post("/api/send-email", async (req, res) => {
  try {
    const { from, to, subject, text } = req.body;
    if (!from || !to || !subject || !text) {
      return res.status(400).json({ error: "Faltan campos requeridos." });
    }

    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST.value(),
      port: EMAIL_PORT.value(),
      secure: EMAIL_PORT.value() == 465,
      auth: { user: EMAIL_USER.value(), pass: EMAIL_PASS.value() },
    });

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: `<p>${text}</p>`,
    });

    res.json({ message: "Correo enviado con éxito." });
  } catch (err) {
    logger.error("❌ Error al enviar correo:", err.message);
    res.status(500).json({ error: "Error al enviar el correo." });
  }
});

// 🆕 REGISTRO CON ÁLBUM
app.post("/api/register-with-album", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Faltan email o contraseña." });

    const userRecord = await admin.auth().createUser({ email, password });
    const token = await getGooglePhotosToken();
    const albumId = await createAlbum(token, `Fotos de ${userRecord.uid}`);

    if (!albumId) {
      await admin.auth().deleteUser(userRecord.uid);
      return res
        .status(500)
        .json({ error: "Error al crear álbum de Google Photos." });
    }

    await admin.database().ref(`users/${userRecord.uid}`).set({ email, albumId });
    res.status(201).json({
      message: "Usuario registrado y álbum creado con éxito.",
      userId: userRecord.uid,
      albumId,
    });
  } catch (err) {
    logger.error("❌ Error en registro:", err.message);
    res.status(500).json({ error: "Error en el registro." });
  }
});

// 📸 SUBIR FOTOS
// ⚠️ Aquí NO usamos express.json()
app.post("/api/upload-photos", upload.array("photos"), async (req, res) => {
  try {
    const { targetUserEmail } = req.body;
    const files = req.files;
    if (!targetUserEmail || !files?.length)
      return res.status(400).json({ error: "Faltan email o archivos." });

    const userRecord = await admin.auth().getUserByEmail(targetUserEmail);
    const userData = (
      await admin.database().ref(`users/${userRecord.uid}`).once("value")
    ).val();
    if (!userData?.albumId)
      return res.status(404).json({ error: "Álbum no encontrado." });

    const token = await getGooglePhotosToken();

    // Paso 1: subir bytes -> uploadTokens
    const uploadResponses = await Promise.all(
      files.map((file) =>
        axios.post("https://photoslibrary.googleapis.com/v1/uploads", file.buffer, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-type": "application/octet-stream",
            "X-Goog-Upload-File-Name": file.originalname,
            "X-Goog-Upload-Protocol": "raw",
          },
        })
      )
    );

    const newMediaItems = uploadResponses.map((r, i) => ({
      description: "Foto subida desde la app",
      simpleMediaItem: { uploadToken: r.data, fileName: files[i].originalname },
    }));

    // Paso 2: crear mediaItems en el álbum
    await axios.post(
      "https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate",
      { albumId: userData.albumId, newMediaItems },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({ message: "Fotos subidas correctamente.", count: files.length });
  } catch (err) {
    logger.error("❌ Error en subida de fotos:", err.message);
    res.status(500).json({ error: "Error al subir fotos." });
  }
});
// 🖼️ GALERÍA
app.get("/api/gallery/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const userData = (
      await admin.database().ref(`users/${userId}`).once("value")
    ).val();
    if (!userData?.albumId)
      return res.status(404).json({ error: "Álbum no encontrado." });

    const token = await getGooglePhotosToken();
    const photosResponse = await axios.post(
      "https://photoslibrary.googleapis.com/v1/mediaItems:search",
      { albumId: userData.albumId, pageSize: 100 },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const photos = photosResponse.data.mediaItems || [];
    res.json(
      photos.map((p) => ({
        id: p.id,
        baseUrl: p.baseUrl,
        filename: p.filename,
      }))
    );
  } catch (err) {
    logger.error("❌ Error al cargar galería:", err.message);
    res.status(500).json({ error: "Error al cargar galería." });
  }
});

// 🗑️ ELIMINAR FOTO
app.post("/api/delete-photo/:photoId", async (req, res) => {
  try {
    const { photoId } = req.params;
    const { userId } = req.body;
    if (!photoId || !userId)
      return res.status(400).json({ error: "Faltan datos." });

    const userData = (
      await admin.database().ref(`users/${userId}`).once("value")
    ).val();
    if (!userData?.albumId)
      return res.status(404).json({ error: "Álbum no encontrado." });

    const token = await getGooglePhotosToken();
    await axios.post(
      `https://photoslibrary.googleapis.com/v1/albums/${userData.albumId}:batchRemoveMediaItems`,
      { mediaItemIds: [photoId] },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({ message: "Foto eliminada correctamente." });
  } catch (err) {
    logger.error("❌ Error al eliminar foto:", err.message);
    res.status(500).json({ error: "Error al eliminar foto." });
  }
});



// ---------------- EXPORTAR API ----------------
export const api = onRequest(
  {
    secrets: [
      EMAIL_HOST,
      EMAIL_PORT,
      EMAIL_USER,
      EMAIL_PASS,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REFRESH_TOKEN,
    ],
  },
  app
);
