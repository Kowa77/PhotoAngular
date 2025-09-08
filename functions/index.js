import admin from "firebase-admin";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import axios from "axios";
import multer from "multer";

// Firebase Functions V2
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";

// Importar la función getDatabase
import { getDatabase } from "firebase-admin/database";

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

// Middleware global (solo para JSON, no multipart)
app.use(cors({ origin: true }));

// Multer: para manejar uploads
const upload = multer({ storage: multer.memoryStorage() });

// ---------------- RUTAS ----------------

// 📸 SUBIDA DE FOTOS (multipart)
app.post("/upload-photos", upload.array("photos"), async (req, res) => {
  try {
    const { targetUserEmail } = req.body;
    const files = req.files;

    if (!targetUserEmail || !files || files.length === 0) {
      return res.status(400).json({ error: "Se requieren email y archivos." });
    }

    logger.log("✅ Archivos recibidos:", files.length, "para:", targetUserEmail);

    // TODO: subir a Google Photos aquí
    res.json({ message: "Fotos subidas correctamente.", count: files.length });
  } catch (error) {
    logger.error("❌ Error en upload-photos:", error);
    res.status(500).json({ error: "Error al subir fotos." });
  }
});

// 📧 ENVIAR EMAIL (usa JSON)
app.post("/send-email", express.json(), async (req, res) => {
  const { from, to, subject, text } = req.body;
  if (!from || !to || !subject || !text) {
    return res.status(400).json({ error: "Faltan campos requeridos." });
  }
  try {
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST.value(),
      port: Number(EMAIL_PORT.value()),
      secure: Number(EMAIL_PORT.value()) === 465,
      auth: { user: EMAIL_USER.value(), pass: EMAIL_PASS.value() },
    });
    await transporter.sendMail({ from, to, subject, text });
    res.json({ message: "Correo enviado con éxito." });
  } catch (err) {
    logger.error("❌ Error al enviar correo:", err.message);
    res.status(500).json({ error: "Hubo un error al enviar el correo." });
  }
});

// 👤 REGISTRO + ÁLBUM (usa JSON)
app.post("/register-with-album", express.json(), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Faltan email y/o contraseña." });

    const userRecord = await admin.auth().createUser({ email, password });
    const token = await getGooglePhotosToken();
    const albumId = await createAlbum(token, `Fotos de ${userRecord.uid}`);

    if (!albumId) {
      await admin.auth().deleteUser(userRecord.uid);
      return res.status(500).json({ error: "Error al crear álbum." });
    }

    await admin.database().ref(`users/${userRecord.uid}`).set({ email, albumId });
    res.status(201).json({ userId: userRecord.uid, albumId });
  } catch (err) {
    logger.error("❌ Error en register-with-album:", err.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// 👀 GALERÍA
app.get("/gallery/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const snapshot = await admin.database().ref(`users/${userId}`).once("value");
    const userData = snapshot.val();
    if (!userData?.albumId)
      return res.status(404).json({ error: "No se encontró el álbum." });

    const token = await getGooglePhotosToken();
    const photosResponse = await axios.post(
      "https://photoslibrary.googleapis.com/v1/mediaItems:search",
      { albumId: userData.albumId, pageSize: 100 },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json(
      (photosResponse.data.mediaItems || []).map((p) => ({
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

// 👤 ADMIN ESTADÍSTICAS
app.get("/admin/photo-stats", async (req, res) => {
  try {
    const token = await getGooglePhotosToken();
    const usersSnapshot = await admin.database().ref("users").once("value");
    const usersData = usersSnapshot.val();
    let totalPhotos = 0;

    if (usersData) {
      for (const userId in usersData) {
        const { albumId } = usersData[userId];
        if (!albumId) continue;

        let nextPageToken = null;
        do {
          const response = await axios.post(
            "https://photoslibrary.googleapis.com/v1/mediaItems:search",
            { albumId, pageToken: nextPageToken },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          totalPhotos += (response.data.mediaItems || []).length;
          nextPageToken = response.data.nextPageToken || null;
        } while (nextPageToken);
      }
    }
    res.json({ totalPhotos });
  } catch (err) {
    logger.error("❌ Error en estadísticas:", err.message);
    res.status(500).json({ error: "Error en estadísticas." });
  }
});

app.get("/admin/user-count", async (req, res) => {
  try {
    const listUsersResult = await admin.auth().listUsers();
    res.json({ totalUsers: listUsersResult.users.length });
  } catch (err) {
    res.status(500).json({ error: "Error en conteo de usuarios." });
  }
});

// ---------------- HELPERS ----------------
async function getGooglePhotosToken() {
  const auth = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID.value(),
    GOOGLE_CLIENT_SECRET.value()
  );
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN.value() });
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("No se pudo obtener el token de Google Photos.");
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
    logger.error("❌ Error al crear álbum:", err.message);
    return null;
  }
}

// ---------------- EXPORTAR ----------------
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

async function sendNotificationEmail(to, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST.value(),
      port: Number(EMAIL_PORT.value()),
      secure: Number(EMAIL_PORT.value()) === 465,
      auth: {
        user: EMAIL_USER.value(),
        pass: EMAIL_PASS.value(),
      },
    });

    const mailOptions = {
      from: EMAIL_USER.value(),
      to,
      subject,
      text,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.log("✅ [Notificación] Correo de notificación enviado:", info.response);
  } catch (error) {
    if (error instanceof Error) {
      logger.error("❌ [Notificación] Error al enviar correo:", error.message);
    }
    throw new Error("Error al enviar correo de notificación.");
  }
}


// ✅ Cron job que expira reservas pendientes
export const expirePendingReservations = onSchedule("*/10 * * * *", async () => {
  try {
    const db = getDatabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snapshot = await db.ref("reservations").once("value");
    const reservations = snapshot.val();
    if (!reservations) return;

    let expiredCount = 0;
    for (const date of Object.keys(reservations)) {
      const reservationDate = new Date(date);
      reservationDate.setHours(0, 0, 0, 0);

      const expirationLimitDate = new Date(reservationDate);
      expirationLimitDate.setDate(expirationLimitDate.getDate() - 2);

      if (today >= expirationLimitDate) {
        for (const id of Object.keys(reservations[date])) {
          if (reservations[date][id].details.status === "pending") {
            await db.ref(`reservations/${date}/${id}/details/status`).set("expired");
            expiredCount++;

            const userEmail = reservations[date][id].details.userEmail;
            if (userEmail) {
              const subject = "Tu reserva ha expirado";
              const text = `Hola,\n\nTe informamos que tu reserva para el día ${date}
              ha expirado ya que no se confirmó el pago.\n\nPor favor, realiza una nueva reserva.\n\n¡Gracias!`;
              await sendNotificationEmail(userEmail, subject, text);
            }
          }
        }
      }
    }
    logger.log(`⏰ Expiradas ${expiredCount} reservas.`);
  } catch (error) {
    logger.error("❌ Error expirando reservas:", error.message);
  }
});

