// src/app/firebase/firefirebase-service.service.ts

import { Injectable, inject } from '@angular/core';
import { Database, ref, set, get, remove, onValue, push, child } from '@angular/fire/database';
import { Observable, combineLatest, map, tap, from } from 'rxjs';
import { Auth, user, User as FirebaseAuthUser } from '@angular/fire/auth';
import { Servicio } from '../models/servicio.model';
import { Reservation, ReservationItem, ReservationDetails, ReservationsByDateMap } from '../models/reservation.model';


@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private database: Database = inject(Database);
  private auth: Auth = inject(Auth);

  constructor() {
    console.log("FirebaseService: Firebase Database (modular) injected.");
  }

  // --- Métodos para obtener servicios (fotos, videos, extras) ---
  private getCategory<T>(path: string): Observable<T[]> {
    const categoryRef = ref(this.database, path);
    console.log(`FirebaseService: Obteniendo colección de Realtime DB: ${path}`);

    return new Observable(observer => {
      const unsubscribe = onValue(categoryRef, (snapshot) => {
        const data = snapshot.val();
        const items: T[] = [];
        if (data) {
          for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
              const rawItem = data[key];
              let mappedItem: any = { id: key }; // Empieza con el ID del nodo

              const category = path.split('/').pop();

              if (category === 'fotos') {
                mappedItem.nombre = rawItem.nombre_f;
                mappedItem.descripcion = rawItem.descripcion_f;
                mappedItem.precio = rawItem.precio_f;
                mappedItem.imagen = rawItem.imagen_f;
                mappedItem.categoria = 'foto';
              } else if (category === 'videos') {
                mappedItem.nombre = rawItem.nombre_v;
                mappedItem.descripcion = rawItem.descripcion_v;
                mappedItem.precio = rawItem.precio_v;
                mappedItem.imagen = rawItem.imagen_v;
                mappedItem.categoria = 'video';
                // Asegúrate de que rawItem.duracion_v sea un número o se pueda convertir
                mappedItem.duracion = typeof rawItem.duracion_v === 'string' ? Number(rawItem.duracion_v) : rawItem.duracion_v;
              } else if (category === 'extras') {
                mappedItem.nombre = rawItem.nombre_e;
                mappedItem.descripcion = rawItem.descripcion_e;
                mappedItem.precio = rawItem.precio_e;
                mappedItem.imagen = rawItem.imagen_e;
                mappedItem.categoria = 'extra';
                // Asegúrate de que rawItem.duracion_e sea un número o se pueda convertir
                mappedItem.duracion = typeof rawItem.duracion_e === 'string' ? Number(rawItem.duracion_e) : rawItem.duracion_e;
              }
              console.log(`FirebaseService: Mapeando item de ${path}:`, mappedItem); // Log detallado
              items.push(mappedItem as T);
            }
          }
        }
        console.log(`FirebaseService: Datos de ${path} cargados con IDs de nodo y mapeados:`, items);
        observer.next(items);
      }, (error) => {
        console.error(`FirebaseService: Error al obtener categoría ${path} de Realtime DB:`, error);
        observer.error(error);
      });

      return { unsubscribe };
    });
  }

  getFotos(): Observable<Servicio[]> {
    return this.getCategory<Servicio>('servicios/fotos').pipe(
      tap(data => console.log('FirebaseService: Servicios de fotos cargados (modular):', data))
    );
  }

  getVideos(): Observable<Servicio[]> {
    return this.getCategory<Servicio>('servicios/videos').pipe(
      tap(data => console.log('FirebaseService: Servicios de videos cargados (modular):', data))
    );
  }

  getExtras(): Observable<Servicio[]> {
    return this.getCategory<Servicio>('servicios/extras').pipe(
      tap(data => console.log('FirebaseService: Servicios de extras cargados (modular):', data))
    );
  }

  getServicios(): Observable<Servicio[]> {
    console.log("FirebaseService: getServicios - Combinando todos los servicios de Realtime Database.");
    return combineLatest([
      this.getFotos(),
      this.getVideos(),
      this.getExtras()
    ]).pipe(
      map(([fotos, videos, extras]) => {
        const allServicios = [...fotos, ...videos, ...extras];
        console.log("FirebaseService: getServicios - Total de servicios combinados desde Realtime Database:", allServicios.length, allServicios); // Agregado allServicios
        return allServicios;
      })
    );
  }

  // --- Métodos para el carrito de usuario en Realtime Database ---

  obtenerCarritoUsuario(userId: string): Observable<{ [serviceId: string]: number }> {
    const carritoRef = ref(this.database, `carritos/${userId}`);
    console.log(`FirebaseService: Suscribiéndose a carrito de Realtime DB para UID: ${userId}`);

    return new Observable(observer => {
      const unsubscribe = onValue(carritoRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          console.log(`FirebaseService: Carrito recibido de Realtime DB para ${userId}:`, data);
          observer.next(data as { [serviceId: string]: number });
        } else {
          console.log(`FirebaseService: Carrito vacío o no existe en Realtime DB para ${userId}.`);
          observer.next({});
        }
      }, (error) => {
        console.error(`FirebaseService: Error al obtener carrito de Realtime DB para ${userId}:`, error);
        observer.error(error);
      });

      return { unsubscribe };
    });
  }

  async guardarCarritoUsuario(userId: string, carrito: { [serviceId: string]: number }): Promise<void> {
    const carritoRef = ref(this.database, `carritos/${userId}`);
    console.log(`FirebaseService: Guardando/actualizando carrito completo en Realtime DB para ${userId}:`, carrito);
    await set(carritoRef, carrito);
    console.log(`FirebaseService: Carrito completo guardado exitosamente en Realtime DB para ${userId}.`);
  }

  async addToCart(userId: string, item: Servicio): Promise<void> {
    const itemRef = ref(this.database, `carritos/${userId}/${item.id}`);
    console.log(`FirebaseService: Añadiendo/actualizando ${item.nombre} (ID: ${item.id}) en carrito de Realtime DB para ${userId}.`);
    await set(itemRef, 1);
    console.log(`FirebaseService: Servicio ${item.id} añadido/actualizado en Realtime DB para ${userId}.`);
  }

  async quitarDelCarrito(userId: string, serviceIdToRemove: string): Promise<void> {
    const itemRef = ref(this.database, `carritos/${userId}/${serviceIdToRemove}`);
    console.log(`FirebaseService: Intentando remover ${serviceIdToRemove} de carrito de Realtime DB para ${userId}.`);
    await remove(itemRef);
    console.log(`FirebaseService: Servicio ${serviceIdToRemove} quitado de Realtime DB para ${userId}.`);
  }

  // --- Métodos para Reservas y Agenda ---

  async saveReservation(userId: string, reservationDate: string, cartItems: ReservationItem[], total: number): Promise<string> {
    const reservationsRef = ref(this.database, `reservations/${reservationDate}`);
    const newReservationRef = push(reservationsRef); // Genera un ID único para la reserva

    const reservationId = newReservationRef.key;

    if (!reservationId) {
      throw new Error("No se pudo generar un ID para la reserva.");
    }

    const reservationDetails: ReservationDetails = {
      date: reservationDate,
      userId: userId,
      totalAmount: total,
      timestamp: Date.now(),
      status: 'pending'
    };

    const reservationToSave: Reservation = {
      id: reservationId,
      details: reservationDetails,
      items: cartItems.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as { [serviceId: string]: ReservationItem })
    };

    console.log(`FirebaseService: Guardando nueva reserva (ID: ${reservationId}) para ${userId} en ${reservationDate}:`, reservationToSave);
    await set(newReservationRef, reservationToSave);
    console.log(`FirebaseService: Reserva ${reservationId} guardada exitosamente.`);

    return reservationId;
  }

  hasReservationForDate(userId: string, date: string): Observable<boolean> {
    const reservationsForDateRef = ref(this.database, `reservations/${date}`);
    console.log(`FirebaseService: Verificando reservas para el usuario ${userId} en la fecha ${date}`);

    return from(get(reservationsForDateRef)).pipe(
      map(snapshot => {
        const reservationsMap = snapshot.val();
        if (!reservationsMap) {
          console.log(`FirebaseService: No hay reservas registradas para la fecha ${date}.`);
          return false;
        }
        const hasExisting = Object.values(reservationsMap).some(
          (reservation: any) => reservation.details && reservation.details.userId === userId
        );
        console.log(`FirebaseService: ¿El usuario ${userId} tiene reserva para ${date}? ${hasExisting}`);
        return hasExisting;
      }),
      tap(result => console.log('FirebaseService: Resultado final de hasReservationForDate:', result))
    );
  }

  allReservations$(): Observable<ReservationsByDateMap> {
    const allReservationsRef = ref(this.database, `reservations`);
    console.log("FirebaseService: Suscribiéndose a todas las reservas en Realtime DB.");

    return new Observable(observer => {
      const unsubscribe = onValue(allReservationsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          console.log("FirebaseService: Todas las reservas recibidas:", data);
          observer.next(data as ReservationsByDateMap);
        } else {
          console.log("FirebaseService: No hay reservas en Realtime DB.");
          observer.next({});
        }
      }, (error) => {
        console.error("FirebaseService: Error al obtener todas las reservas:", error);
        observer.error(error);
      });

      return { unsubscribe };
    });
  }

  getReservationsForDate(date: string): Observable<{ [reservationId: string]: Reservation }> {
    const dateReservationsRef = ref(this.database, `reservations/${date}`);
    console.log(`FirebaseService: Obteniendo reservas para la fecha: ${date}`);

    return new Observable(observer => {
      const unsubscribe = onValue(dateReservationsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          console.log(`FirebaseService: Reservas para ${date} recibidas:`, data);
          observer.next(data as { [reservationId: string]: Reservation });
        } else {
          console.log(`FirebaseService: No hay reservas para la fecha ${date}.`);
          observer.next({});
        }
      }, (error) => {
        console.error(`FirebaseService: Error al obtener reservas para ${date}:`, error);
        observer.error(error);
      });

      return { unsubscribe };
    });
  }

  async cancelReservation(reservationDate: string, reservationId: string): Promise<void> {
    const reservationRef = ref(this.database, `reservations/${reservationDate}/${reservationId}`);
    console.log(`FirebaseService: Intentando cancelar reserva ${reservationId} en ${reservationDate}.`);
    await remove(reservationRef);
    console.log(`FirebaseService: Reserva ${reservationId} cancelada exitosamente.`);
  }

  // --- Métodos de disponibilidad (para el administrador) ---

  async setDayAvailability(date: string, isAvailable: boolean, maxBookings?: number): Promise<void> {
    const availabilityRef = ref(this.database, `availability/${date}`);
    console.log(`FirebaseService: Estableciendo disponibilidad para ${date}: ${isAvailable}, MaxBookings: ${maxBookings}`);
    await set(availabilityRef, { available: isAvailable, maxBookings: maxBookings || null });
    console.log(`FirebaseService: Disponibilidad para ${date} guardada.`);
  }

  getDayAvailability(date: string): Observable<{ available: boolean; maxBookings: number | null } | null> {
    const availabilityRef = ref(this.database, `availability/${date}`);
    return new Observable(observer => {
      const unsubscribe = onValue(availabilityRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          observer.next(data);
        } else {
          observer.next(null);
        }
      }, (error) => {
        observer.error(error);
      });
      return { unsubscribe };
    });
  }

  getAllAvailabilities(): Observable<{ [date: string]: { available: boolean; maxBookings: number | null } }> {
    const allAvailabilityRef = ref(this.database, `availability`);
    return new Observable(observer => {
      const unsubscribe = onValue(allAvailabilityRef, (snapshot) => {
        const data = snapshot.val();
        observer.next(data || {});
      }, (error) => {
        observer.error(error);
      });
      return { unsubscribe };
    });
  }
}
