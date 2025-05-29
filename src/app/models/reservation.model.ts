// src/app/models/reservation.model.ts

export interface ReservationItem {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  cantidad: number;
  // No necesitamos imagen, categoria o duracion aquí, ya que la reserva guarda el "estado" del item al momento de la reserva
}

export interface ReservationDetails {
  date: string; // Formato YYYY-MM-DD
  userId: string;
  totalAmount: number;
  timestamp: number; // Marca de tiempo de creación
  status: 'pending' | 'confirmed' | 'cancelled'; // Estado de la reserva
}

export interface Reservation {
  id: string; // El ID único de la reserva (generado por push)
  details: ReservationDetails;
  items: { [serviceId: string]: ReservationItem }; // Mapa de items reservados
}

export interface ReservationsByDateMap {
  [date: string]: {
    [reservationId: string]: Reservation;
  };
}
