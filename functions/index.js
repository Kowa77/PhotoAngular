// functions/index.js
import admin from "firebase-admin";
import express from "express";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import axios from "axios";
import busboy from "busboy";
import { Buffer } from "buffer";

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

// ---------------- CORS ----------------
const allowedOrigins = [
  "http://localhost:4200",                       // desarrollo local
  "https://bsfotografia-9fc03.web.app",          // hosting Firebase
  "https://bsfotografia-9fc03.firebaseapp.com",  // dominio alterno de Firebase
  "https://tudominio.com"                        // si tenés custom domain
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});
// ---------------- CORS ----------------
// app.use((req, res, next) => {
//   res.setHeader("Access-Control-Allow-Origin", "http://localhost:4200");
//   res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
//   res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
//   res.setHeader("Access-Control-Allow-Credentials", "true");

//   if (req.method === "OPTIONS") {
//     return res.status(204).end();
//   }
//   next();
// });

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

// 📊 Estadísticas de fotos
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
        let nextPageToken;
        do {
          const photosResponse = await axios.post(
            "https://photoslibrary.googleapis.com/v1/mediaItems:search",
            { albumId, pageSize: 100, pageToken: nextPageToken },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const items = photosResponse.data.mediaItems || [];
          totalPhotos += items.length;
          nextPageToken = photosResponse.data.nextPageToken;
        } while (nextPageToken);
      } catch (err) {
        logger.warn(`⚠️ No se puede listar fotos del álbum ${albumId}`);
      }
    }

    res.json({ totalPhotos, usersWithAlbums });
  } catch (error) {
    logger.error("❌ Error en /admin/photo-stats:", error.message);
    res.status(500).json({ error: "Error al obtener estadísticas de fotos" });
  }
});

// ✅ Versión compatible con tu front actual
app.get("/admin/user-count", async (req, res) => {
  try {
    let nextPageToken = undefined;
    let totalUsers = 0;

    do {
      const { users, pageToken } = await admin
        .auth()
        .listUsers(1000, nextPageToken);
      totalUsers += users.length;
      nextPageToken = pageToken;
    } while (nextPageToken);

    res.status(200).json({ totalUsers });
  } catch (error) {
    logger.error("❌ Error en /admin/user-count:", error.message);
    res.status(500).json({ error: "Error al obtener cantidad de usuarios" });
  }
});

// 🚀 SUBIDA DE FOTOS (con Busboy)
app.post("/upload-photos", (req, res) => {
  console.log("➡️ [Subida] Solicitud de subida de fotos recibida.");

  const bb = busboy({ headers: req.headers });
  const files = [];
  let targetUserEmail = "";
  let responded = false;

  bb.on("file", (fieldname, file, info) => {
    const { filename } = info;
    const buffer = [];
    file.on("data", (data) => buffer.push(data));
    file.on("end", () => {
      files.push({ originalname: filename, buffer: Buffer.concat(buffer) });
    });
  });

  bb.on("field", (fieldname, value) => {
    if (fieldname === "targetUserEmail") targetUserEmail = value;
  });

  bb.on("finish", async () => {
    if (responded) return;

    if (!targetUserEmail || files.length === 0) {
      responded = true;
      return res
        .status(400)
        .json({ error: "El correo del usuario y los archivos son requeridos." });
    }

    try {
      const userRecord = await admin.auth().getUserByEmail(targetUserEmail);
      const snapshot = await admin
        .database()
        .ref(`users/${userRecord.uid}`)
        .once("value");
      const userData = snapshot.val();

      if (!userData || !userData.albumId) {
        responded = true;
        return res
          .status(404)
          .json({ error: "ID de álbum no encontrado para el usuario." });
      }

      const albumId = userData.albumId;
      const token = await getGooglePhotosToken();

      // Subir archivos → obtener uploadToken
      const uploadResponses = await Promise.all(
        files.map((file) =>
          axios.post("https://photoslibrary.googleapis.com/v1/uploads", file.buffer, {
            headers: {
              "Content-Type": "application/octet-stream",
              Authorization: `Bearer ${token}`,
              "X-Goog-Upload-File-Name": file.originalname,
              "X-Goog-Upload-Protocol": "raw",
            },
          })
        )
      );

      const newMediaItems = uploadResponses.map((r) => ({
        simpleMediaItem: { uploadToken: r.data },
      }));

      // Crear mediaItems dentro del álbum
      await axios.post(
        "https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate",
        { albumId, newMediaItems },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      responded = true;
      res
        .status(200)
        .json({ message: "Fotos subidas y añadidas al álbum correctamente." });
    } catch (error) {
      console.error("❌ [Subida] Error al subir fotos:", error.message);
      if (!responded) {
        responded = true;
        if (error.code === "auth/user-not-found") {
          res
            .status(404)
            .json({ error: "El usuario con ese correo electrónico no existe." });
        } else {
          res
            .status(500)
            .json({ error: "Error interno del servidor al subir las fotos." });
        }
      }
    }
  });

  bb.on("error", (err) => {
    console.error("❌ Busboy error:", err);
    if (!responded) {
      responded = true;
      res.status(500).json({ error: "Error procesando archivos" });
    }
  });

  // 👇 Muy importante: al final
  bb.end(req.rawBody);
});


// 🚀 ELIMINAR FOTO DE MOMENTO ESTARA DESHABILITADA (NO ES UNA FUNCION NECESARIA)
// app.post("/delete-photo/:photoId", async (req, res) => {
//   const { photoId } = req.params;
//   const { userId } = req.body;

//   if (!photoId || !userId) {
//     return res.status(400).json({ error: "Faltan parámetros (photoId o userId)." });
//   }

//   try {
//     const token = await getGooglePhotosToken();

//     // Google Photos API para eliminar mediaItem
//     await axios.post(
//       `https://photoslibrary.googleapis.com/v1/mediaItems:batchRemove`,
//       {
//         mediaItemIds: [photoId],
//         albumId: null // opcional, si quieres desvincular de un álbum en particular
//       },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//       }
//     );

//     res.status(200).json({ message: `Foto ${photoId} eliminada con éxito.` });
//   } catch (error) {
//     console.error("❌ [Eliminar Foto] Error:", error.response?.data || error.message);
//     res.status(500).json({ error: "Error eliminando la foto." });
//   }
// });



// ---------------- RUTAS API EXTRA ----------------

// 📧 ENVIAR CORREO
app.post("/send-email", express.json(), async (req, res) => {
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
app.post("/register-with-album", express.json(), async (req, res) => {
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

    await admin
      .database()
      .ref(`users/${userRecord.uid}`)
      .set({ email, albumId });

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

// 🖼️ GALERÍA
app.get("/gallery/:userId", async (req, res) => {
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
