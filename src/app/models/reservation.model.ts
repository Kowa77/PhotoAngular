export interface Reservation {
  id: string; // ID único generado por push() de Firebase
  details: ReservationDetails;
  items: { [serviceId: string]: ReservationItem };
}

export interface ReservationDetails {
  date: string;
  userId: string;
  totalAmount: number;
  paidAmount: number; // <-- 🔥 nuevo: cuánto se pagó ya
  timestamp: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  isRead?: boolean;
}

export interface ReservationItem {
  id: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  cantidad: number;
  imagen?: string;
  categoria?: string;
  duracion?: number | null;
}

export interface ReservationsByDateMap {
  [date: string]: {
    [reservationId: string]: Reservation;
  };
}

export interface DailyAvailabilityMap {
  [date: string]: DailyAvailabilityEntry;
}

export interface DailyAvailabilityEntry {
  available: boolean;
  maxBookings: number | null;
  bookedBy?: string;
}
