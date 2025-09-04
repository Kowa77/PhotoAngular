// Importa las librerías necesarias.
const express = require('express');
const admin = require('firebase-admin');

// Inicializa Express.
const app = express();

// --- Configuración de Firebase Admin ---
// En lugar de un archivo de credenciales, Render.com usa variables de entorno
// por seguridad. 'FIREBASE_SERVICE_ACCOUNT' será una variable que configurarás
// en la plataforma de Render.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://bsfotografia-9fc03-default-rtdb.firebaseio.com", // Reemplaza con la URL de tu base de datos
});

// Esta es tu función principal, adaptada para ser llamada como una tarea.
async function expirePendingReservations() {
  console.log("Comenzando el proceso de expiración de reservas pendientes.");

  try {
    const db = admin.database();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reservationsRef = db.ref("reservations");
    const snapshot = await reservationsRef.once("value");
    const allReservationsByDate = snapshot.val();

    if (!allReservationsByDate) {
      console.log("No se encontraron reservas. Proceso terminado.");
      return "No se encontraron reservas.";
    }

    const dates = Object.keys(allReservationsByDate);
    let expiredCount = 0;

    for (const date of dates) {
      const reservationDate = new Date(date);
      reservationDate.setHours(0, 0, 0, 0);

      if (reservationDate < today) {
        const reservationsForDate = allReservationsByDate[date];
        const reservationIds = Object.keys(reservationsForDate);

        for (const id of reservationIds) {
          const reservation = reservationsForDate[id];

          if (reservation.details.status === "pending") {
            console.log(`Marcando reserva ${id} de la fecha ${date} como expirada.`);

            const statusRef = db.ref(`reservations/${date}/${id}/details/status`);
            await statusRef.set("expired");
            expiredCount++;
          }
        }
      }
    }

    const message = `Proceso de expiración terminado. Se actualizaron ${expiredCount} reservas.`;
    console.log(message);
    return message;
  } catch (error) {
    console.error("Error en la función de expiración de reservas:", error);
    return "Error en la función.";
  }
}

// --- Rutas del Servidor ---

// Define un endpoint que, cuando se visite, ejecute tu función.
app.get('/expire-reservations', async (req, res) => {
  const result = await expirePendingReservations();
  res.send(result);
});

// Ruta principal para verificar que el servidor está funcionando.
app.get('/', (req, res) => {
    res.send('El servidor de PhotoAngular está en funcionamiento.');
});

// --- Inicia el servidor ---

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
