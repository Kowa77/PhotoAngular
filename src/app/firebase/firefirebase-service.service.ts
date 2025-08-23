// src/app/firebase/firefirebase-service.service.ts

import { Injectable, inject } from '@angular/core';
import { Database, ref, set, get, remove, onValue, push, runTransaction } from '@angular/fire/database';
import { Observable, combineLatest, map, tap, from, defer } from 'rxjs';
import { Auth, user, User as FirebaseAuthUser } from '@angular/fire/auth';
import { Servicio } from '../models/servicio.model';
import { Reservation, ReservationItem, ReservationDetails, ReservationsByDateMap, DailyAvailabilityMap, DailyAvailabilityEntry } from '../models/reservation.model';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  // --- CAMBIO CLAVE AQUÍ: Usar inject() en la declaración de propiedades ---
  private database: Database = inject(Database);
  private auth: Auth = inject(Auth);
  private authService: AuthService = inject(AuthService);

  constructor() {
    console.log("FirebaseService: Firebase Database (modular) injected.");
  }

  /**
   * Método privado genérico para obtener una colección de servicios de Realtime Database.
   * Se asegura de que la propiedad 'duracion' sea siempre un número o null, nunca undefined.
   * @param path La ruta al nodo de la base de datos (ej. 'servicios/casamientos/fotos').
   * @returns Un Observable que emite un array de objetos Servicio.
   */
  private getCategory<T extends Servicio>(path: string): Observable<T[]> {
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
              let mappedItem: Servicio = {
                id: key,
                nombre: '',
                descripcion: '',
                precio: 0,
                imagen: '',
                categoria: 'foto' // Valor predeterminado
              };

              // Lógica de mapeo adaptada para las nuevas rutas
              const category = path.split('/').pop();

              if (category === 'fotos') {
                mappedItem.nombre = rawItem.nombre_f;
                mappedItem.descripcion = rawItem.descripcion_f;
                mappedItem.precio = rawItem.precio_f;
                mappedItem.imagen = rawItem.imagen_f;
                mappedItem.categoria = 'foto';
                mappedItem.duracion = null; // Para fotos, la duración es null.
              } else if (category === 'videos') {
                mappedItem.nombre = rawItem.nombre_v;
                mappedItem.descripcion = rawItem.descripcion_v;
                mappedItem.precio = rawItem.precio_v;
                mappedItem.imagen = rawItem.imagen_v;
                mappedItem.categoria = 'video';
                // Usar ?? null para asegurar que sea number o null, nunca undefined
                mappedItem.duracion = typeof rawItem.duracion_v === 'string' ? Number(rawItem.duracion_v) : (rawItem.duracion_v ?? null);
              } else if (category === 'extras' || category === 'sugeridos') {
                mappedItem.nombre = rawItem.nombre_e;
                mappedItem.descripcion = rawItem.descripcion_e;
                mappedItem.precio = rawItem.precio_e;
                mappedItem.imagen = rawItem.imagen_e;
                mappedItem.categoria = (category === 'extras') ? 'extra' : 'sugerido';
                // Usar ?? null para asegurar que sea number o null, nunca undefined
                mappedItem.duracion = typeof rawItem.duracion_e === 'string' ? Number(rawItem.duracion_e) : (rawItem.duracion_e ?? null);
              }
              // CAPA DE SEGURIDAD: Si por alguna razón `duracion` sigue siendo undefined, lo establecemos a null.
              if (mappedItem.duracion === undefined) {
                mappedItem.duracion = null;
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

  // --- Métodos para el carrito de usuario en Realtime Database ---
  // --- CAMBIO CLAVE AQUÍ: obtenerCarritoUsuario devuelve un mapa de IDs a CANTIDADES ---
  obtenerCarritoUsuario(userId: string): Observable<{ [serviceId: string]: number }> {
    const carritoRef = ref(this.database, `carritos/${userId}`);
    console.log(`FirebaseService: Suscribiéndose a carrito de Realtime DB para UID: ${userId} en ruta: ${carritoRef.toString()}`);

    return defer(() => {
      return new Observable<{ [serviceId: string]: number }>(observer => {
        // Hacemos una lectura inicial con 'get'
        get(carritoRef).then(initialSnapshot => {
          const initialData = initialSnapshot.val();
          console.log(`FirebaseService: (DEBUG) Lectura inicial del carrito para ${userId}:`, initialData);
          observer.next(initialData || {});
        }).catch(error => {
          console.error(`FirebaseService: Error en lectura inicial de carrito para ${userId}:`, error);
          // observer.error(error); // No emitir error si queremos que el onValue siga funcionando
        });

        // Luego, nos suscribimos a cambios en tiempo real con 'onValue'
        const unsubscribe = onValue(carritoRef, (snapshot) => {
          const data = snapshot.val();
          console.log(`FirebaseService: (DEBUG) onValue snapshot.val() recibido para carrito de ${userId}:`, data);

          // Emitimos los datos tal cual vienen de Firebase, que es un mapa de ID a CANTIDAD
          if (data) {
            console.log(`FirebaseService: Carrito en tiempo real recibido de Realtime DB para ${userId}:`, data);
            observer.next(data as { [serviceId: string]: number });
          } else {
            console.log(`FirebaseService: Carrito en tiempo real vacío o no existe en Realtime DB para ${userId}.`);
            observer.next({});
          }
        }, (error) => {
          console.error(`FirebaseService: Error al obtener carrito en tiempo real de Realtime DB para ${userId}:`, error);
          observer.error(error);
        });

        return { unsubscribe: () => unsubscribe() };
      });
    });
  }

  // --- CAMBIO CLAVE AQUÍ: guardarCarritoUsuario ahora guarda el objeto CartItem completo ---
  // Esto es para que `obtenerCarritoUsuario` pueda reconstruir el CartItem completo.
  // Pero espera, tu Firebase REALMENTE solo guarda la cantidad.
  // Si `guardarCarritoUsuario` recibiera un `Cart` completo (o un mapa de `CartItem`),
  // entonces la estructura en Firebase cambiaría.
  // Dado que tu Firebase solo guarda la cantidad, entonces `guardarCarritoUsuario`
  // debería recibir `{[serviceId: string]: number}`.

  // Revierto a cómo estaba si la intención es solo guardar la cantidad en Firebase.
  async guardarCarritoUsuario(userId: string, carrito: { [serviceId: string]: number }): Promise<void> {
    const carritoRef = ref(this.database, `carritos/${userId}`);
    console.log(`FirebaseService: Guardando/actualizando carrito completo en Realtime DB para ${userId}:`, carrito);
    await set(carritoRef, carrito);
    console.log(`FirebaseService: Carrito completo guardado exitosamente en Realtime DB para ${userId}.`);
  }

  async addToCart(userId: string, item: Servicio): Promise<void> {
    const itemRef = ref(this.database, `carritos/${userId}/${item.id}`);
    console.log(`FirebaseService: Añadiendo/actualizando ${item.nombre} (ID: ${item.id}) en carrito de Realtime DB para ${userId}.`);
    // Aquí solo guardamos la cantidad, no el objeto Servicio completo.
    // Asumiendo que siempre añadimos 1 al hacer click en "añadir"
    await set(itemRef, 1); // <--- Esto sobrescribirá cualquier cantidad existente a 1.
                         // Si quieres incrementar, necesitarías leer la cantidad actual y sumarle 1.
    console.log(`FirebaseService: Servicio ${item.id} añadido/actualizado en Realtime DB para ${userId}.`);
  }

  // --- Si `addToCart` solo guarda "1", y tu Firebase muestra "1",
  // entonces el problema no es en guardar.

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

      if (transactionResult.committed) { // commited significa que la transacción se aplicó correctamente
        console.log(`FirebaseService: Transacción de disponibilidad para ${reservationDate} exitosa.`);

        const reservationsForDateRef = ref(this.database, `reservations/${reservationDate}`); // Referencia al nodo de reservas para la fecha específica
        const newReservationRef = push(reservationsForDateRef); // Crear una nueva referencia con ID único generado por Firebase push()
        reservationId = newReservationRef.key;   // Obtener el ID generado
        if (!reservationId) {
          throw new Error("No se pudo generar un ID para la reserva.");
        }

        // Construir el objeto Reservation a guardar en la base de datos y asegurarse de que 'duracion' no sea undefined en los items
        // Es importante que 'duracion' sea number o null, nunca undefined, para evitar problemas en Firebase (no permite undefined)
        const reservationDetails: ReservationDetails = {
          date: reservationDate,
          userId: userId,
          totalAmount: total,
          timestamp: Date.now(),
          status: 'pending'  // Estado inicial de la reserva, luego puede cambiar a 'confirmed' o 'cancelled' (hay que implementar esa lógica)
        };

        const cleanedReservationItems: { [serviceId: string]: ReservationItem } = {}; // Mapa limpio de items de reserva a guardar en Firebase

        cartItems.forEach(item => { // Iterar sobre los items del carrito proporcionados por el usuario y limpiarlos si es necesario
          const cleanItem = { ...item }; // Clonar el item para no modificar el original del carrito
          if (cleanItem.duracion === undefined) {
            cleanItem.duracion = null; // Convertir undefined a null para Firebase
          }
          cleanedReservationItems[item.id] = cleanItem;
        });

        //Reservation se define en el modelo reservation.model
        const reservationToSave: Reservation = {
          id: reservationId,
          details: reservationDetails,
          items: cleanedReservationItems // Usar los ítems ya limpiados
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
          // Asegurarse de que bookedBy no sea undefined si no se establece explícitamente.
          return { ...currentData, available: false, bookedBy: currentData?.bookedBy ?? null };
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
                bookedBy: data[dateKey].bookedBy || null // <-- CAMBIO AQUÍ: null en lugar de undefined para bookedBy al leer
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
          // Asegurar que los items de la reserva no tengan undefined en duracion al leer
          const cleanedData: ReservationsByDateMap[string] = {};
          for (const reservationId in data) {
            if (Object.prototype.hasOwnProperty.call(data, reservationId)) {
              const reservation = { ...data[reservationId] }; // Clonar la reserva
              if (reservation.items) {
                for (const itemId in reservation.items) {
                  if (Object.prototype.hasOwnProperty.call(reservation.items, itemId)) {
                    if (reservation.items[itemId].duracion === undefined) {
                      reservation.items[itemId].duracion = null; // Convertir undefined a null
                    }
                  }
                }
              }
              cleanedData[reservationId] = reservation;
            }
          }
          console.log(`FirebaseService: Reservas recibidas para ${date}:`, cleanedData);
          observer.next(cleanedData as ReservationsByDateMap[string]);
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
