// src/app/models/reservation.model.ts

export interface Reservation {
  id: string; // ID único generado por push() de Firebase
  details: ReservationDetails;
  items: { [serviceId: string]: ReservationItem }; // Mapa de ReservationItem por serviceId
}
export interface ReservationDetails {
  date: string; // Formato YYYY-MM-DD
  userId: string;
  totalAmount: number;
  timestamp: number; // Marca de tiempo de creación
  status: 'pending' | 'confirmed' | 'cancelled';
}
export interface ReservationItem {
  id: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  cantidad: number;
  imagen?: string;
  categoria?: string;
  duracion?: number | null; // Mantener consistencia con CartItem
}
// Tipo original para el mapa de reservas por fecha (ej: de /reservations)
export interface ReservationsByDateMap {
  [date: string]: {
    [reservationId: string]: Reservation;
  };
}

//los dos DailyAvailability(Entry/Map) son para "disponibilidad diaria de reservas"
//  se usa en el carrito para ver la disponibilidad diaria de las fechas
export interface DailyAvailabilityMap {
  [date: string]: DailyAvailabilityEntry;
}
export interface DailyAvailabilityEntry {
  available: boolean;                      // true si está disponible, false si ya está reservado
  maxBookings: number | null;              // null significa sin límite de reservas
  bookedBy?: string;                       // Opcional, para saber quién lo reservó si hay una sola reserva
}


