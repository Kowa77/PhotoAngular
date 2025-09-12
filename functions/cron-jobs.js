// scheduled-jobs.js
import admin from "firebase-admin"
import cron from "node-cron" // Importamos node-cron
import * as functions from "firebase-functions"

/**
 * Función programada para cancelar automáticamente las reservas vencidas.
 * Se ejecuta cada 10 minutos (para pruebas).
 * Para producción usar "0 0 * * *" (medianoche).
 */
export const cancelExpiredReservations = () => {
  // La lógica de cron se inicia al llamar a esta función
  cron.schedule("*/10 * * * *", async () => {
    const db = admin.database()
    console.log("Iniciando la revisión de reservas vencidas.")

    // Obtener todas las reservas
    const allReservationsRef = db.ref("reservations")
    const snapshot = await allReservationsRef.once("value")
    const reservationsByDate = snapshot.val()

    console.log("Datos de la base de datos:", reservationsByDate)

    let canceledCount = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const date in reservationsByDate) {
      if (Object.prototype.hasOwnProperty.call(reservationsByDate, date)) {
        const dayReservations = reservationsByDate[date]
        for (const reservationId in dayReservations) {
          if (Object.prototype.hasOwnProperty.call(dayReservations, reservationId)) {
            const reservation = dayReservations[reservationId]

            console.log("Procesando reserva:", reservation.details)

            if (reservation.details && reservation.details.status === "pending") {
              const reservationDate = new Date(reservation.details.date)
              const dueDate = new Date(reservationDate)
              dueDate.setDate(dueDate.getDate() - 7)

              if (dueDate.getTime() <= today.getTime()) {
                try {
                  await db
                    .ref(`reservations/${date}/${reservationId}/details/status`)
                    .set("expired")
                  console.log(
                    `✅ Reserva ${reservationId} para la fecha ${date} ha sido cancelada por vencimiento.`
                  )
                  canceledCount++
                } catch (error) {
                  console.error(
                    `❌ Error al cancelar la reserva ${reservationId}:`,
                    error
                  )
                }
              }
            }
          }
        }
      }
    }

    console.log(`Finalizada la revisión. Total de reservas canceladas: ${canceledCount}.`)
  })
}

// Nueva función para marcar notificaciones como leídas
export const markNotificationAsRead = functions.https.onCall(async (data) => {
  const { date, reservationId } = data
  const db = admin.database()

  try {
    await db.ref(`reservations/${date}/${reservationId}/details/isRead`).set(true)
    console.log(`✅ Notificación para la reserva ${reservationId} marcada como leída.`)
    return { success: true }
  } catch (error) {
    console.error(`❌ Error al marcar como leída la reserva ${reservationId}:`, error)
    return { success: false, error: error.message }
  }
})
