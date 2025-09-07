// src/app/firebase/firefirebase-service.service.ts
import { inject, Injectable, runInInjectionContext, Injector } from '@angular/core';
import { Database, ref, set, get, remove, push, runTransaction, onValue } from '@angular/fire/database';
import { Observable, combineLatest, map } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { Servicio } from '../models/servicio.model';
import { Reservation, ReservationItem, ReservationDetails, ReservationsByDateMap, DailyAvailabilityMap } from '../models/reservation.model';
import { AuthService } from '../auth/auth.service';
import { fromRef, ListenEvent, objectVal } from '@angular/fire/database';
import { serverTimestamp } from 'firebase/database';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private database: Database = inject(Database);
  private injector = inject(Injector);
  private auth: Auth = inject(Auth);
  private authService: AuthService = inject(AuthService);

  // -------------------------------------------------------------------------
  // 📂 SERVICIOS (catálogo)
  // -------------------------------------------------------------------------

getCategory<T extends Servicio>(path: string): Observable<T[]> {
  const categoryRef = ref(this.database, path);
  //console.log('getCategory: creando observable para path =>', path);

  return objectVal<Record<string, any>>(categoryRef).pipe(
    map((data) => {
      //console.log('getCategory: datos crudos recibidos de Firebase =>', { path, data });
      return this.mapServicios<T>(path, data);
    })
  );
}

private mapServicios<T extends Servicio>(path: string, data: Record<string, any> | null): T[] {
  //console.log('mapServicios: llamado con path =>', path);
  //console.log('mapServicios: data recibido =>', data);

  if (!data) {
    console.warn('mapServicios: data está vacío/null, retorno []');
    return [];
  }

  return Object.entries(data).map(([key, value]) => {
    //console.log('mapServicios: procesando item =>', { key, value });

    let categoria: 'foto' | 'video' | 'extra' | 'sugerido' = 'foto';
    let sufijo = '';

    if (path.includes('fotos')) { categoria = 'foto'; sufijo = '_f'; }
    else if (path.includes('videos')) { categoria = 'video'; sufijo = '_v'; }
    else if (path.includes('extras')) { categoria = 'extra'; sufijo = '_e'; }
    else if (path.includes('sugeridos')) { categoria = 'sugerido'; sufijo = '_s'; }

    const servicio: T = {
      id: key,
      nombre: value[`nombre${sufijo}`] || '',
      descripcion: value[`descripcion${sufijo}`] || '',
      precio: value[`precio${sufijo}`] || 0,
      imagen: value[`imagen${sufijo}`] || '',
      categoria,
      duracion: value[`duracion${sufijo}`] ?? null,
    } as T;

    //console.log('mapServicios: servicio mapeado =>', servicio);
    return servicio;
  });
}


  getServiciosCasamientos(): Observable<Servicio[]> {
    return combineLatest([
      this.getCategory<Servicio>('servicios/casamientos/fotos'),
      this.getCategory<Servicio>('servicios/casamientos/videos')
    ]).pipe(map(([fotos, videos]) => [...fotos, ...videos]));
  }

  getServiciosCumpleanos(): Observable<Servicio[]> {
    return combineLatest([
      this.getCategory<Servicio>('servicios/cumpleaños/fotos'),
      this.getCategory<Servicio>('servicios/cumpleaños/videos')
    ]).pipe(map(([fotos, videos]) => [...fotos, ...videos]));
  }

  getServiciosSugeridos(): Observable<Servicio[]> {
    return this.getCategory<Servicio>('servicios/sugeridos');
  }

  getExtras(): Observable<Servicio[]> {
    return this.getCategory<Servicio>('servicios/extras');
  }

  getTodosLosServicios(): Observable<Servicio[]> {
    return combineLatest([
      this.getServiciosCasamientos(),
      this.getServiciosCumpleanos(),
      this.getServiciosSugeridos(),
      this.getExtras()
    ]).pipe(map(([casamientos, cumpleanos, sugeridos, extras]) =>
      [...casamientos, ...cumpleanos, ...sugeridos, ...extras]
    ));
  }

  // -------------------------------------------------------------------------
  // 🛒 CARRITO
  // -------------------------------------------------------------------------

  obtenerCarritoUsuario(userId: string): Observable<{ [serviceId: string]: { cantidad: number; duracion?: number } }> {
    const carritoRef = ref(this.database, `carritos/${userId}`);

    return runInInjectionContext(this.injector, () =>
      fromRef(carritoRef, 'value' as ListenEvent).pipe(
        map(snap => snap.snapshot.val() || {})
      )
    );
  }

  async guardarCarritoUsuario(userId: string, carrito: { [serviceId: string]: number }): Promise<void> {
    await set(ref(this.database, `carritos/${userId}`), carrito);
  }

  async addToCart(userId: string, item: Servicio, duration: number = 1): Promise<void> {
    const itemRef = ref(this.database, `carritos/${userId}/${item.id}`);
    await set(itemRef, { cantidad: 1, duracion: duration, fechaCompra: serverTimestamp() });
  }

  async quitarDelCarrito(userId: string, serviceId: string): Promise<void> {
    await remove(ref(this.database, `carritos/${userId}/${serviceId}`));
  }

  // -------------------------------------------------------------------------
  // 📅 RESERVAS
  // -------------------------------------------------------------------------

  async saveReservation(
    userId: string,
    reservationDate: string,
    cartItems: ReservationItem[],
    total: number,
    status: 'pending' | 'confirmed'
  ): Promise<string> {
    const availabilityRef = ref(this.database, `availability/${reservationDate}`);
    let reservationId: string | null = null;

    const transactionResult = await runTransaction(availabilityRef, (currentData) => {
      if (currentData === null || currentData.available === true) {
        return { available: false, maxBookings: 1, bookedBy: userId };
      }
      return undefined;
    });

    if (!transactionResult.committed) throw new Error(`El día ${reservationDate} ya ha sido reservado.`);

    const reservationsForDateRef = ref(this.database, `reservations/${reservationDate}`);
    const newReservationRef = push(reservationsForDateRef);
    reservationId = newReservationRef.key!;

    const reservationDetails: ReservationDetails = {
      date: reservationDate,
      userId,
      totalAmount: total,
      timestamp: Date.now(),
      status
    };

    const cleanedItems: { [serviceId: string]: ReservationItem } = {};
    cartItems.forEach(item => {
      cleanedItems[item.id] = { ...item, duracion: item.duracion ?? null };
    });

    await set(newReservationRef, { id: reservationId, details: reservationDetails, items: cleanedItems });
    return reservationId;
  }

  async cancelReservation(reservationDate: string, reservationId: string): Promise<void> {
    const reservationRef = ref(this.database, `reservations/${reservationDate}/${reservationId}`);
    const availabilityRef = ref(this.database, `availability/${reservationDate}`);

    const snapshot = await get(reservationRef);
    const reservationData = snapshot.val();
    const currentUserUid = await this.authService.getCurrentUserUid();

    if (!currentUserUid || !reservationData || reservationData.details.userId !== currentUserUid) {
      throw new Error('No tienes permiso para cancelar esta reserva.');
    }

    await remove(reservationRef);
    const remaining = (await get(ref(this.database, `reservations/${reservationDate}`))).val();

    await runTransaction(availabilityRef, (currentData) => {
      if (!remaining || Object.keys(remaining).length === 0) {
        return { available: true, maxBookings: 1, bookedBy: null };
      }
      return { ...currentData, available: false, bookedBy: currentData?.bookedBy ?? null };
    });
  }

  allReservations$(): Observable<DailyAvailabilityMap> {
    const allAvailabilityRef = ref(this.database, `availability`);
    return runInInjectionContext(this.injector, () =>
      new Observable(observer => {
        const unsubscribe = onValue(allAvailabilityRef, (snapshot) => {
          const data = snapshot.val();
          const mapped: DailyAvailabilityMap = {};
          if (data) {
            for (const dateKey in data) {
              mapped[dateKey] = {
                available: !!data[dateKey].available,
                maxBookings: data[dateKey].maxBookings || null,
                bookedBy: data[dateKey].bookedBy || null
              };
            }
          }
          observer.next(mapped);
        }, (error) => observer.error(error));
        return { unsubscribe };
      })
    );
  }

  getReservationsForDate(date: string): Observable<ReservationsByDateMap[string]> {
    const reservationsDateRef = ref(this.database, `reservations/${date}`);
    return runInInjectionContext(this.injector, () =>
      new Observable(observer => {
        const unsubscribe = onValue(reservationsDateRef, (snapshot) => {
          const data = snapshot.val();
          if (!data) return observer.next({});
          const cleaned: ReservationsByDateMap[string] = {};
          for (const id in data) {
            const reservation = { ...data[id] };
            if (reservation.items) {
              for (const itemId in reservation.items) {
                if (reservation.items[itemId].duracion === undefined) {
                  reservation.items[itemId].duracion = null;
                }
              }
            }
            cleaned[id] = reservation;
          }
          observer.next(cleaned);
        }, (error) => observer.error(error));
        return { unsubscribe };
      })
    );
  }

  getUserReservations(userId: string): Observable<Reservation[]> {
    const allReservationsRef = ref(this.database, `reservations`);
    return runInInjectionContext(this.injector, () =>
      new Observable(observer => {
        const unsubscribe = onValue(allReservationsRef, (snapshot) => {
          const allData = snapshot.val();
          const userReservations: Reservation[] = [];
          if (allData) {
            for (const dateKey in allData) {
              const reservationsForDate = allData[dateKey];
              for (const reservationId in reservationsForDate) {
                const reservation = reservationsForDate[reservationId];
                if (reservation.details?.userId === userId) {
                  for (const itemId in reservation.items) {
                    if (reservation.items[itemId].duracion === undefined) {
                      reservation.items[itemId].duracion = null;
                    }
                  }
                  userReservations.push(reservation as Reservation);
                }
              }
            }
          }
          observer.next(userReservations);
        }, (error) => observer.error(error));
        return { unsubscribe };
      })
    );
  }
}
