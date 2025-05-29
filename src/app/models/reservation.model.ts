// src/app/models/reservation.model.ts

import { Servicio } from './servicio.model'; // Importa Servicio

// Representa un ítem dentro de una reserva (ej. un servicio con su cantidad)
export interface ReservationItem {
  id: string; // ID del servicio
  nombre: string;
  precio: number;
  cantidad: number;
  imagen?: string; // Opcional
}

// Representa los datos de una reserva de un usuario en una fecha específica
export interface UserReservationData {
  date: string; // Fecha de la reserva en formato 'YYYY-MM-DD'
  // Puedes añadir más campos aquí como 'status', 'total', etc.
}

// Estructura de Firebase para una entrada de reserva (si guardas así)
// Por ejemplo, `reservations/$date/$uid/items` y `reservations/$date/$uid/details`
export interface ReservationEntry {
  uid: string;
  items: { [serviceId: string]: ReservationItem };
  details?: UserReservationData; // Información adicional de la reserva (ej. la fecha)
}

// Si allReservations$ es un objeto mapeado por fecha y luego por UID
export interface AllReservationsMap {
  [date: string]: {
    [uid: string]: ReservationEntry; // O un tipo más simplificado si solo necesitas el UID y la fecha
  };
}
