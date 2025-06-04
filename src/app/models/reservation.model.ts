// src/app/models/reservation.model.ts

export interface ReservationItem {
  id: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  cantidad: number;
  imagen?: string;
  categoria?: string;
  duracion?: number;
}

export interface ReservationDetails {
  date: string; // Formato YYYY-MM-DD
  userId: string;
  totalAmount: number;
  timestamp: number; // Marca de tiempo de creación
  status: 'pending' | 'confirmed' | 'cancelled';
}

export interface Reservation {
  id: string; // ID único generado por push() de Firebase
  details: ReservationDetails;
  items: { [serviceId: string]: ReservationItem }; // Mapa de ReservationItem por serviceId
}

// Tipo original para el mapa de reservas por fecha (ej: de /reservations)
export interface ReservationsByDateMap {
  [date: string]: {
    [reservationId: string]: Reservation;
  };
}

// ¡NUEVO TIPO! Para el mapa de disponibilidad del día (ej: de /availability)
// Esto es lo que allReservations$() del FirebaseService ahora devuelve
export interface DailyAvailabilityEntry {
  available: boolean;
  maxBookings: number | null;
  bookedBy?: string; // Opcional, para saber quién lo reservó si hay una sola reserva
}

export interface DailyAvailabilityMap {
  [date: string]: DailyAvailabilityEntry;
}
