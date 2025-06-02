// src/app/firebase/firefirebase-service.service.ts

import { Injectable, inject } from '@angular/core';
import { Database, ref, set, get, remove, onValue, push, runTransaction } from '@angular/fire/database';
import { Observable, combineLatest, map, tap, from } from 'rxjs';
import { Auth, user, User as FirebaseAuthUser } from '@angular/fire/auth';
import { Servicio } from '../models/servicio.model';
// ¡Importa DailyAvailabilityMap y DailyAvailabilityEntry! (Ya estaban correctos)
import { Reservation, ReservationItem, ReservationDetails, ReservationsByDateMap, DailyAvailabilityMap, DailyAvailabilityEntry } from '../models/reservation.model';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private database: Database = inject(Database);
  private auth: Auth = inject(Auth);
  private authService: AuthService = inject(AuthService);

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
              let mappedItem: any = { id: key };

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
                mappedItem.duracion = typeof rawItem.duracion_v === 'string' ? Number(rawItem.duracion_v) : rawItem.duracion_v;
              } else if (category === 'extras') {
                mappedItem.nombre = rawItem.nombre_e;
                mappedItem.descripcion = rawItem.descripcion_e;
                mappedItem.precio = rawItem.precio_e;
                mappedItem.imagen = rawItem.imagen_e;
                mappedItem.categoria = 'extra';
                mappedItem.duracion = typeof rawItem.duracion_e === 'string' ? Number(rawItem.duracion_e) : rawItem.duracion_e;
              }
              console.log(`FirebaseService: Mapeando item de ${path}:`, mappedItem);
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
        console.log("FirebaseService: getServicios - Total de servicios combinados desde Realtime Database:", allServicios.length, allServicios);
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
    const availabilityRef = ref(this.database, `availability/${reservationDate}`);
    let reservationId: string | null = null;

    try {
      const transactionResult = await runTransaction(availabilityRef, (currentData) => {
        console.log(`FirebaseService: runTransaction - currentData para ${reservationDate}:`, currentData);

        // Si el día está nulo o disponible, se puede reservar
        if (currentData === null || currentData.available === true) {
          console.log(`FirebaseService: Día ${reservationDate} disponible. Marcando como no disponible.`);
          return { available: false, maxBookings: 1, bookedBy: userId }; // Guardar bookedBy
        } else {
          console.warn(`FirebaseService: El día ${reservationDate} ya está ocupado, transacción abortada.`);
          return undefined; // Abortar transacción
        }
      });

      if (transactionResult.committed) {
        console.log(`FirebaseService: Transacción de disponibilidad para ${reservationDate} exitosa.`);

        const reservationsForDateRef = ref(this.database, `reservations/${reservationDate}`);
        const newReservationRef = push(reservationsForDateRef);

        reservationId = newReservationRef.key;

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

      } else {
        // La transacción no se comprometió (ej. el día ya estaba ocupado)
        throw new Error(`El día ${reservationDate} ya ha sido reservado. Por favor, elige otra fecha.`);
      }

    } catch (error: any) {
      console.error('FirebaseService: Error al procesar la reserva transaccional:', error);
      throw error;
    }
  }

  async cancelReservation(reservationDate: string, reservationId: string): Promise<void> {
    const reservationRef = ref(this.database, `reservations/${reservationDate}/${reservationId}`);
    const availabilityRef = ref(this.database, `availability/${reservationDate}`);

    try {
      const snapshot = await get(reservationRef);
      const reservationData = snapshot.val();

      // Usar el servicio de autenticación para obtener el UID actual
      const currentUserUid = await from(this.authService.getCurrentUserUid()).toPromise(); // Convertir Observable a Promise

      if (!currentUserUid || !reservationData || reservationData.details.userId !== currentUserUid) {
        throw new Error('No tienes permiso para cancelar esta reserva o la reserva no existe.');
      }

      await remove(reservationRef);
      console.log(`FirebaseService: Reserva ${reservationId} cancelada exitosamente.`);

      // Contar las reservas restantes para ese día después de la cancelación
      const remainingReservationsSnapshot = await get(ref(this.database, `reservations/${reservationDate}`));
      const remainingReservations = remainingReservationsSnapshot.val();

      await runTransaction(availabilityRef, (currentData) => {
        console.log(`FirebaseService: runTransaction - Liberando ${reservationDate}. currentData:`, currentData);

        if (!remainingReservations || Object.keys(remainingReservations).length === 0) {
          // Si no quedan más reservas para ese día, marcar como disponible
          console.log(`Día ${reservationDate} no tiene más reservas. Marcando como disponible.`);
          return { available: true, maxBookings: 1, bookedBy: null }; // bookedBy a null
        } else {
          // Si todavía quedan reservas, el día sigue no disponible
          console.log(`Día ${reservationDate} aún tiene ${Object.keys(remainingReservations).length} reservas. Sigue no disponible.`);
          // Puedes optar por mantener el 'bookedBy' del primer/último restante, o dejarlo como estaba si no es importante
          // ¡CAMBIOS AQUÍ! Asegurarse de mantener el 'bookedBy' si aún hay reservas
          return { ...currentData, available: false, bookedBy: currentData?.bookedBy || null };
        }
      });
      console.log(`FirebaseService: Disponibilidad de ${reservationDate} actualizada después de cancelación.`);

    } catch (error) {
      console.error('FirebaseService: Error al cancelar reserva:', error);
      throw error;
    }
  }

  // --- Métodos de lectura de Reservas y Disponibilidad (para el calendario/agenda) ---

  allReservations$(): Observable<DailyAvailabilityMap> {
    const allAvailabilityRef = ref(this.database, `availability`);
    console.log("FirebaseService: Suscribiéndose a la disponibilidad de todos los días en Realtime DB.");

    return new Observable(observer => {
      const unsubscribe = onValue(allAvailabilityRef, (snapshot) => {
        const data = snapshot.val();
        const mappedData: DailyAvailabilityMap = {};
        if (data) {
          for (const dateKey in data) {
            if (Object.prototype.hasOwnProperty.call(data, dateKey)) {
              // Asegúrate de que 'available' sea un booleano explícito
              mappedData[dateKey] = {
                available: typeof data[dateKey].available === 'boolean' ? data[dateKey].available : true, // Por defecto a true si no es booleano (seguro)
                maxBookings: data[dateKey].maxBookings || null,
                bookedBy: data[dateKey].bookedBy || undefined
              };
            }
          }
        }
        console.log(`FirebaseService: Disponibilidad de todos los días cargada:`, mappedData);
        observer.next(mappedData);
      }, (error) => {
        console.error(`FirebaseService: Error al obtener la disponibilidad de todos los días de Realtime DB:`, error);
        observer.error(error);
      });

      return { unsubscribe };
    });
  }

  // ¡¡¡FALTA ESTE MÉTODO EN TU CÓDIGO ACTUAL!!!
  // Agrega este método al final de tu clase FirebaseService
  getReservationsForDate(date: string): Observable<ReservationsByDateMap[string]> {
    const reservationsDateRef = ref(this.database, `reservations/${date}`);
    console.log(`FirebaseService: Obteniendo reservas para la fecha: ${date}`);

    return new Observable(observer => {
      const unsubscribe = onValue(reservationsDateRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          console.log(`FirebaseService: Reservas recibidas para ${date}:`, data);
          observer.next(data as ReservationsByDateMap[string]);
        } else {
          console.log(`FirebaseService: No hay reservas para ${date}.`);
          observer.next({}); // Devuelve un objeto vacío si no hay reservas
        }
      }, (error) => {
        console.error(`FirebaseService: Error al obtener reservas para la fecha ${date}:`, error);
        observer.error(error);
      });

      return { unsubscribe };
    });
  }
}
