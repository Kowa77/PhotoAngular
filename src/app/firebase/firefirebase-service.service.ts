// src/app/firebase/firefirebase-service.service.ts

import { Injectable, inject } from '@angular/core';
import { Database, ref, set, get, remove, onValue, push, runTransaction } from '@angular/fire/database';
import { Observable, combineLatest, map, tap, from } from 'rxjs';
import { Auth, user, User as FirebaseAuthUser } from '@angular/fire/auth';
import { Servicio } from '../models/servicio.model';
import { Reservation, ReservationItem, ReservationDetails, ReservationsByDateMap, DailyAvailabilityMap, DailyAvailabilityEntry } from '../models/reservation.model';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private database: Database = inject(Database);
  private auth: Auth = inject(Auth);
  private authService: AuthService = inject(AuthService); // Inyectar AuthService para obtener el UID del usuario actual

  constructor() {
    console.log("FirebaseService: Firebase Database (modular) injected.");
  }

  // --- MÉTODOS REFACTORIZADOS PARA LA NUEVA ESTRUCTURA DE BD ---

  /**
   * Método privado genérico para obtener una colección de servicios de Realtime Database.
   * @param path La ruta al nodo de la base de datos (ej. 'servicios/casamientos/fotos').
   * @returns Un Observable que emite un array de objetos Servicio.
   */
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

              // Lógica de mapeo adaptada para las nuevas rutas
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
              } else if (category === 'extras' || category === 'sugeridos') {
                mappedItem.nombre = rawItem.nombre_e;
                mappedItem.descripcion = rawItem.descripcion_e;
                mappedItem.precio = rawItem.precio_e;
                mappedItem.imagen = rawItem.imagen_e;
                mappedItem.categoria = (category === 'extras') ? 'extra' : 'sugerido';
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

  // --- Nuevos métodos públicos para cada tipo de servicio ---

  getServiciosCasamientos(): Observable<Servicio[]> {
    return combineLatest([
      this.getCategory<Servicio>('servicios/casamientos/fotos'),
      this.getCategory<Servicio>('servicios/casamientos/videos')
    ]).pipe(
      map(([fotos, videos]) => [...fotos, ...videos]),
      tap(data => console.log('Servicios de casamientos cargados:', data))
    );
  }

  getServiciosCumpleanos(): Observable<Servicio[]> {
    return combineLatest([
      this.getCategory<Servicio>('servicios/cumpleaños/fotos'),
      this.getCategory<Servicio>('servicios/cumpleaños/videos')
    ]).pipe(
      map(([fotos, videos]) => [...fotos, ...videos]),
      tap(data => console.log('Servicios de cumpleaños cargados:', data))
    );
  }

  getServiciosSugeridos(): Observable<Servicio[]> {
    return this.getCategory<Servicio>('servicios/sugeridos').pipe(
      tap(data => console.log('Servicios sugeridos cargados:', data))
    );
  }

  getExtras(): Observable<Servicio[]> {
    return this.getCategory<Servicio>('servicios/extras').pipe(
      tap(data => console.log('Servicios de extras cargados:', data))
    );
  }

  /**
   * Combina todos los servicios de todas las categorías en un solo Observable.
   */
  getTodosLosServicios(): Observable<Servicio[]> {
    console.log("FirebaseService: getTodosLosServicios - Combinando todos los servicios de Realtime Database.");
    return combineLatest([
      this.getServiciosCasamientos(),
      this.getServiciosCumpleanos(),
      this.getServiciosSugeridos(),
      this.getExtras()
    ]).pipe(
      map(([casamientos, cumpleanos, sugeridos, extras]) => {
        const allServicios = [...casamientos, ...cumpleanos, ...sugeridos, ...extras];
        console.log("FirebaseService: getTodosLosServicios - Total de servicios combinados:", allServicios.length, allServicios);
        return allServicios;
      })
    );
  }

  // --- MÉTODOS ORIGINALES (NO NECESITAN CAMBIOS) ---

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

        if (currentData === null || currentData.available === true) {
          console.log(`FirebaseService: Día ${reservationDate} disponible. Marcando como no disponible.`);
          return { available: false, maxBookings: 1, bookedBy: userId };
        } else {
          console.warn(`FirebaseService: El día ${reservationDate} ya está ocupado, transacción abortada.`);
          return undefined;
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
      const currentUserUid = await from(this.authService.getCurrentUserUid()).toPromise();

      if (!currentUserUid || !reservationData || reservationData.details.userId !== currentUserUid) {
        throw new Error('No tienes permiso para cancelar esta reserva o la reserva no existe.');
      }

      await remove(reservationRef);
      console.log(`FirebaseService: Reserva ${reservationId} cancelada exitosamente.`);

      const remainingReservationsSnapshot = await get(ref(this.database, `reservations/${reservationDate}`));
      const remainingReservations = remainingReservationsSnapshot.val();

      await runTransaction(availabilityRef, (currentData) => {
        console.log(`FirebaseService: runTransaction - Liberando ${reservationDate}. currentData:`, currentData);

        if (!remainingReservations || Object.keys(remainingReservations).length === 0) {
          console.log(`Día ${reservationDate} no tiene más reservas. Marcando como disponible.`);
          return { available: true, maxBookings: 1, bookedBy: null };
        } else {
          console.log(`Día ${reservationDate} aún tiene ${Object.keys(remainingReservations).length} reservas. Sigue no disponible.`);
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
              mappedData[dateKey] = {
                available: typeof data[dateKey].available === 'boolean' ? data[dateKey].available : true,
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
          observer.next({});
        }
      }, (error) => {
        console.error(`FirebaseService: Error al obtener reservas para la fecha ${date}:`, error);
        observer.error(error);
      });

      return { unsubscribe };
    });
  }
}
