// La biblioteca 'firebase-functions' proporciona las herramientas para crear
// funciones en la nube.
const functions = require("firebase-functions");

// La biblioteca 'firebase-admin' es necesaria para interactuar
// con los servicios de Firebase, como la Realtime Database.
const admin = require("firebase-admin");

// Inicializa el Admin SDK. Esto le da a tu función los permisos para
// leer y escribir en tu base de datos.
admin.initializeApp();

// Esta es la función principal. El nombre que le das (exports.expirePendingReservations)
// será el nombre de la función en la consola de Firebase.

// 'pubsub.schedule' es un trigger que ejecuta la función en un horario fijo.
// El string '0 1 * * *' es una expresión cron que significa:
// a la 1:00 AM, todos los días.
exports.expirePendingReservations = functions.pubsub
    .schedule("0 1 * * *")
    .onRun(async (context) => {
      // Referencia a tu base de datos.
      const db = admin.database();

      // Obtiene la fecha de hoy sin la hora, para poder compararla con la
      // fecha de las reservas.
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Registra un mensaje en los logs de la función para saber que se ha iniciado.
      functions.logger.log("Comenzando el proceso de expiración de reservas pendientes.");

      try {
        // Obtiene una instantánea de todas las reservas en tu base de datos.
        const reservationsRef = db.ref("reservations");
        const snapshot = await reservationsRef.once("value");
        const allReservationsByDate = snapshot.val();

        if (!allReservationsByDate) {
          functions.logger.log("No se encontraron reservas. Proceso terminado.");
          return null; // Termina la función si no hay reservas
        }

        // Itera sobre cada fecha que tiene reservas.
        const dates = Object.keys(allReservationsByDate);
        let expiredCount = 0;

        for (const date of dates) {
          const reservationDate = new Date(date);
          reservationDate.setHours(0, 0, 0, 0);

          // Comprueba si la fecha de la reserva es anterior a la fecha actual.
          if (reservationDate < today) {
            const reservationsForDate = allReservationsByDate[date];
            const reservationIds = Object.keys(reservationsForDate);

            // Itera sobre cada reserva en esa fecha.
            for (const id of reservationIds) {
              const reservation = reservationsForDate[id];

              // Si el estado de la reserva es 'pending' (pendiente), lo actualiza a 'expired'.
              if (reservation.details.status === "pending") {
                functions.logger.log(`Marcando reserva ${id} de la fecha ${date} como expirada.`);

                const statusRef = db.ref(`reservations/${date}/${id}/details/status`);
                await statusRef.set("expired");
                expiredCount++;
              }
            }
          }
        }

        // Registra un mensaje final con el número de reservas actualizadas.
        functions.logger.log(`Proceso de expiración terminado. Se actualizaron ${expiredCount} reservas.`);
        return null;
      } catch (error) {
        // Si ocurre un error, lo registra en los logs de la función.
        functions.logger.error("Error en la función de expiración de reservas:", error);
        return null;
      }
    });
