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

// Define secretos
const EMAIL_HOST = defineSecret("EMAIL_HOST");
const EMAIL_PORT = defineSecret("EMAIL_PORT");
const EMAIL_USER = defineSecret("EMAIL_USER");
const EMAIL_PASS = defineSecret("EMAIL_PASS");
const GOOGLE_CLIENT_ID = defineSecret("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = defineSecret("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = defineSecret("GOOGLE_REFRESH_TOKEN");

// Inicialización de Firebase
try {
  admin.initializeApp();
} catch (error) {
  if (error.code !== "app/duplicate-app") {
    throw error;
  }
}

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });


// Para multipart → se maneja solo con multer, SIN express.json() ni express.urlencoded()
app.post("/upload-photos", upload.array("photos"), async (req, res) => {
  try {
    const { targetUserEmail } = req.body;
    const files = req.files;

    if (!targetUserEmail || !files || files.length === 0) {
      return res.status(400).json({ error: "Se requieren email y archivos." });
    }

    // ... lógica de Google Photos / Storage aquí ...
    res.json({ message: "Fotos subidas correctamente." });
  } catch (error) {
    console.error("❌ Error en upload-photos:", error);
    res.status(500).json({ error: "Error al subir fotos." });
  }
});

// ---------------- FUNCIONES ----------------

async function sendEmail(req, res) {
  const { from, to, subject, text } = req.body;

  if (!from || !to || !subject || !text) {
    logger.error("❌ [Correo] Faltan campos requeridos.");
    res
      .status(400)
      .json({ error: "Faltan campos requeridos: from, to, subject, o text." });
    return;
  }

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

    const mailOptions = { from, to, subject, text };

    const info = await transporter.sendMail(mailOptions);
    logger.log("✅ [Correo] Correo enviado exitosamente:", info.response);

    res.status(200).json({ message: "¡Tu mensaje se ha enviado con éxito!" });
  } catch (error) {
    if (error instanceof Error) {
      logger.error("❌ [Correo] Error al enviar el correo:", error.message);
    }
    res.status(500).json({ error: "Hubo un error al enviar el correo." });
  }
}

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
    logger.log(
      "✅ [Notificación] Correo de notificación enviado:",
      info.response
    );
  } catch (error) {
    if (error instanceof Error) {
      logger.error(
        "❌ [Notificación] Error al enviar correo de notificación:",
        error.message
      );
    }
    throw new Error("Error al enviar correo de notificación.");
  }
}

async function getGooglePhotosToken() {
  try {
    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID.value(),
      GOOGLE_CLIENT_SECRET.value()
    );
    auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN.value() });
    const { token } = await auth.getAccessToken();
    if (!token) throw new Error("No token received");
    return token;
  } catch (error) {
    if (error instanceof Error) {
      logger.error("❌ Error al obtener token de acceso:", error.message);
    }
    throw new Error("No se pudo obtener el token de Google Photos.");
  }
}

async function createAlbum(token, albumTitle) {
  try {
    const response = await axios.post(
      "https://photoslibrary.googleapis.com/v1/albums",
      { album: { title: albumTitle } },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data.id;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        "❌ Error al crear álbum:",
        error.response?.data?.error || error.message
      );
    } else if (error instanceof Error) {
      logger.error("❌ Error al crear álbum:", error.message);
    }
    return null;
  }
}

// ---------------- RUTAS ----------------
app.get("/", (req, res) => res.send("✅ API funcionando"));
app.post("/send-email", sendEmail);

app.post("/register-with-album", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Faltan email y/o contraseña." });
      return;
    }

    const userRecord = await admin.auth().createUser({ email, password });
    logger.log(`✅ Usuario creado UID: ${userRecord.uid}`);

    const token = await getGooglePhotosToken();
    const albumId = await createAlbum(token, `Fotos de ${userRecord.uid}`);

    if (!albumId) {
      await admin.auth().deleteUser(userRecord.uid);
      res.status(500).json({ error: "Error al crear álbum." });
      return;
    }

    await admin
      .database()
      .ref(`users/${userRecord.uid}`)
      .set({ email, albumId });
    res.status(201).json({ userId: userRecord.uid, albumId });
  } catch (error) {
    if (error instanceof Error) {
      logger.error("❌ [Registro] Error:", error.message);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  }
});

app.get("/gallery/:userId", async (req, res) => {
  console.log("Cargando galería para userId:", req.params.userId);
  const { userId } = req.params;
  try {
    const snapshot = await admin.database().ref(`users/${userId}`).once("value");
    const userData = snapshot.val();
    if (!userData || !userData.albumId) {
      res.status(404).json({ error: "No se encontró el álbum." });
      return;
    }

    const token = await getGooglePhotosToken();
    const photosResponse = await axios.post(
      "https://photoslibrary.googleapis.com/v1/mediaItems:search",
      { albumId: userData.albumId, pageSize: 100 },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log(photosResponse.data);
    const photos = photosResponse.data.mediaItems || [];
    console.log(photos);
    res.json(
      photos.map((p) => ({
        id: p.id,
        baseUrl: p.baseUrl,
        filename: p.filename,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Error al cargar galería." });
  }
});





// Eliminar foto
app.post("/delete-photo/:photoId", async (req, res) => {
  const { photoId } = req.params;
  const { userId } = req.body;
  if (!photoId || !userId) {
    res.status(400).json({ error: "Faltan datos." });
    return;
  }

  try {
    const snapshot = await admin.database().ref(`users/${userId}`).once("value");
    const userData = snapshot.val();
    if (!userData || !userData.albumId) {
      res.status(404).json({ error: "No se encontró álbum." });
      return;
    }

    const token = await getGooglePhotosToken();
    await axios.post(
      `https://photoslibrary.googleapis.com/v1/albums/${userData.albumId}:batchRemoveMediaItems`,
      { mediaItemIds: [photoId] },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({ message: "Foto eliminada." });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar foto." });
  }
});

app.get("/admin/photo-stats", async (req, res) => {
  try {
    const token = await getGooglePhotosToken();
    const usersSnapshot = await admin.database().ref("users").once("value");
    const usersData = usersSnapshot.val();
    let totalPhotos = 0;

    if (usersData) {
      for (const userId in usersData) {
        if (Object.hasOwn(usersData, userId)) {
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
    }
    res.json({ totalPhotos });
  } catch (error) {
    logger.error(
      "❌ [Estadísticas] Error al obtener el conteo de fotos:",
      error.message
    );
    res.status(500).json({ error: "Error en estadísticas." });
  }
});

app.get("/admin/user-count", async (req, res) => {
  try {
    const listUsersResult = await admin.auth().listUsers();
    res.json({ totalUsers: listUsersResult.users.length });
  } catch (error) {
    res.status(500).json({ error: "Error en conteo de usuarios." });
  }
});

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
            await db
              .ref(`reservations/${date}/${id}/details/status`)
              .set("expired");
            expiredCount++;

            const userEmail = reservations[date][id].details.userEmail;
            if (userEmail) {
              const subject = "Tu reserva ha expirado";
              const text = `Hola,\n\nTe escribimos para informarte que tu reserva para el día ${date}
              ha expirado ya que no se ha confirmado el pago.\n\nPara agendar un nuevo servicio,
              por favor, realiza una nueva reserva.\n\n¡Gracias!`;
              await sendNotificationEmail(userEmail, subject, text);
            }
          }
        }
      }
    }
    logger.log(`Expiradas ${expiredCount} reservas.`);
  } catch (error) {
    logger.error("Error expirando reservas:", error.message);
  }
});
