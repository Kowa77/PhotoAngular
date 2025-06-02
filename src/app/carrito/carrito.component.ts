// src/app/carrito/carrito.component.ts

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ¡CAMBIOS AQUÍ! Importa los módulos de Angular Material para el Datepicker
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Subscription, combineLatest, of } from 'rxjs';
import { switchMap, tap, catchError, map } from 'rxjs/operators';
import { Cart, CartItem } from '../models/cart.model';
import { ReservationItem, DailyAvailabilityMap } from '../models/reservation.model';
import { Servicio } from '../models/servicio.model';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './carrito.component.html',
  styleUrls: ['./carrito.component.css'],
})
export class CarritoComponent implements OnInit, OnDestroy {
  private firebaseService: FirebaseService = inject(FirebaseService);
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);

  cart: Cart | null = null;
  currentUserUid: string | null = null;
  private mainSubscription: Subscription | null = null;
  private availabilitySubscription: Subscription | null = null;

  selectedReservationDate: Date | null = null;
  minDate: Date;
  maxDate: Date;

  allAvailabilityMap: DailyAvailabilityMap = {};

  constructor() {
    const today = new Date();
    this.minDate = today;
    const maxAllowedDate = new Date();
    maxAllowedDate.setFullYear(maxAllowedDate.getFullYear() + 2);
    this.maxDate = maxAllowedDate;
  }

  ngOnInit(): void {
    console.log('CarritoComponent: ngOnInit - Iniciando carga de carrito.');

    this.mainSubscription = this.authService.user$.pipe(
      tap(user => {
        this.currentUserUid = user ? user.uid : null;
        console.log('CarritoComponent: currentUserUid:', this.currentUserUid);
        if (!this.currentUserUid) {
          console.log('CarritoComponent: No hay usuario autenticado, limpiando carrito.');
          this.cart = { items: {}, total: 0 };
        }
      }),
      switchMap(user => {
        if (!user) {
          return of({ cartData: {} as Record<string, number>, allServicios: [] as Servicio[] });
        }
        return combineLatest([
          this.firebaseService.obtenerCarritoUsuario(user.uid).pipe(
            tap(data => console.log('CarritoComponent: Raw cartData received from FirebaseService:', data)),
            catchError(error => {
              console.error('CarritoComponent: Error fetching user cart:', error);
              return of({} as Record<string, number>);
            })
          ),
          this.firebaseService.getServicios().pipe(
            tap(data => console.log('CarritoComponent: allServicios loaded (from combineLatest):', data)),
            catchError(error => {
              console.error('CarritoComponent: Error fetching all services:', error);
              return of([] as Servicio[]);
            })
          )
        ]).pipe(
          map(([cartData, allServicios]: [Record<string, number>, Servicio[]]) => ({ cartData, allServicios }))
        );
      })
    ).subscribe(
      ({ cartData, allServicios }) => {
        if (!this.currentUserUid) {
          console.log('CarritoComponent: Carrito limpiado porque no hay usuario (re-check).');
          this.cart = { items: {}, total: 0 };
          return;
        }

        console.log('CarritoComponent: Processing with cartData and allServicios.');
        console.log('   cartData:', cartData);
        console.log('   allServicios:', allServicios);

        if (cartData && Object.keys(cartData).length > 0 && allServicios && allServicios.length > 0) {
          const items: { [serviceId: string]: CartItem } = {};
          let total = 0;
          let itemsProcessedCount = 0;

          for (const serviceId in cartData) {
            if (cartData.hasOwnProperty(serviceId)) {
              const cantidad = cartData[serviceId];
              const servicio = allServicios.find((s: Servicio) => s.id === serviceId);

              console.log(`CarritoComponent: Processing serviceId: ${serviceId}, Quantity: ${cantidad}, Found service:`, servicio);

              if (servicio) {
                items[serviceId] = {
                  id: servicio.id,
                  nombre: servicio.nombre,
                  descripcion: servicio.descripcion,
                  precio: servicio.precio,
                  cantidad: cantidad,
                  imagen: servicio.imagen,
                  categoria: servicio.categoria,
                  duracion: typeof servicio.duracion === 'string' ? Number(servicio.duracion) : servicio.duracion
                };
                total += servicio.precio * cantidad;
                itemsProcessedCount++;
              } else {
                console.warn(`CarritoComponent: Service with ID ${serviceId} from cart not found in all services. It will NOT be added to the visible cart.`);
              }
            }
          }
          this.cart = { items, total };
          console.log(`CarritoComponent: Successfully processed ${itemsProcessedCount} items. Final visible cart:`, this.cart);
        } else {
          console.log('CarritoComponent: CartData or allServicios is empty/null, setting cart as empty locally.');
          this.cart = { items: {}, total: 0 };
        }
        console.log('CarritoComponent: After update, cartItemsArray.length is:', this.cartItemsArray.length);
      },
      (error) => {
        console.error('CarritoComponent: Major error in main subscription:', error);
        this.cart = { items: {}, total: 0 };
      }
    );

    // ¡CAMBIOS AQUÍ! Suscribirse a la disponibilidad de todos los días
    this.availabilitySubscription = this.firebaseService.allReservations$().pipe(
      tap(data => console.log('CarritoComponent: Daily availability data received:', data)),
      catchError(error => {
        console.error('CarritoComponent: Error fetching daily availability:', error);
        return of({}); // Devuelve un objeto vacío en caso de error
      })
    ).subscribe(
      (availabilityMap: DailyAvailabilityMap) => {
        this.allAvailabilityMap = availabilityMap;
      },
      (error) => {
        console.error('CarritoComponent: Error in availability subscription:', error);
      }
    );
  }

  ngOnDestroy(): void {
    console.log('CarritoComponent: ngOnDestroy - Desuscribiendo.');
    if (this.mainSubscription) {
      this.mainSubscription.unsubscribe();
    }
    if (this.availabilitySubscription) {
      this.availabilitySubscription.unsubscribe();
    }
  }

  get cartItemsArray(): CartItem[] {
    const items = this.cart ? Object.values(this.cart.items) : [];
    console.log('CarritoComponent: cartItemsArray calculated (getter):', items.length, items);
    return items;
  }

  get totalCarrito(): number {
    return this.cart ? this.cart.total : 0;
  }

  trackByItemId(item: CartItem): string {
    return item.id;
  }

  async updateQuantity(serviceId: string, event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const newQuantity = parseInt(target.value, 10);

    if (this.currentUserUid && this.cart && this.cart.items && newQuantity >= 1) {
      const currentItem = this.cart.items[serviceId];
      if (currentItem) {
        const updatedFirebaseCart: { [key: string]: number } = {};
        for (const key in this.cart.items) {
          if (this.cart.items.hasOwnProperty(key)) {
            updatedFirebaseCart[key] = this.cart.items[key].cantidad;
          }
        }
        updatedFirebaseCart[serviceId] = newQuantity;

        await this.firebaseService.guardarCarritoUsuario(this.currentUserUid, updatedFirebaseCart);
        console.log(`CarritoComponent: Cantidad de ${serviceId} actualizada a ${newQuantity} en Firebase.`);
      }
    }
  }

  async removeFromCart(serviceId: string): Promise<void> {
    if (this.currentUserUid && this.cart && this.cart.items) {
      await this.firebaseService.quitarDelCarrito(this.currentUserUid, serviceId);
      console.log(`CarritoComponent: Servicio ${serviceId} eliminado de Firebase.`);
    }
  }

  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onDateSelect(event: any): void {
    this.selectedReservationDate = event.value; // event.value is of type Date
    console.log('Fecha seleccionada del Datepicker:', this.selectedReservationDate);
  }

  // Función dateClass para colorear los días del calendario (sin cambios aquí)
  dateClass = (date: Date): string => {
    const formattedDate = this.formatDateToYYYYMMDD(date);
    const availability = this.allAvailabilityMap[formattedDate];

    if (availability && availability.available === false) { // Usamos '=== false' para ser explícitos
      if (this.currentUserUid && availability.bookedBy === this.currentUserUid) {
        return 'booked-by-current-user';
      }
      return 'booked-by-others';
    }
    return '';
  };

  // ¡¡¡CAMBIOS AQUÍ!!! Nueva función para deshabilitar fechas
  dateFilter = (date: Date | null): boolean => {
    // Si la fecha es nula, no la habilites (aunque mat-datepicker usualmente maneja esto)
    if (!date) {
      return false;
    }

    // Deshabilita fechas pasadas (opcional, si minDate no lo hace ya completamente)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normaliza a inicio del día
    if (date < today) {
      return false; // No permite seleccionar fechas pasadas
    }

    const formattedDate = this.formatDateToYYYYMMDD(date);
    const availability = this.allAvailabilityMap[formattedDate];

    // Si no hay datos de disponibilidad, asumimos que está disponible
    if (!availability) {
      return true;
    }

    // Un día es seleccionable si:
    // 1. Está marcado como 'available: true'
    // 2. O si está marcado como 'available: false' PERO fue reservado por el usuario actual.
    //    Esto permitiría al usuario seleccionar su propia reserva para ver detalles o cancelarla.
    //    Si solo quieres que NO SE PUEDA VOLVER A SELECCIONAR NINGUNA FECHA RESERVADA (ni siquiera la propia),
    //    entonces simplemente devuelve `availability.available`.
    //
    //    Opción 1: Permitir seleccionar tu propia reserva (útil si luego quieres editarla/cancelarla desde aquí)
    return availability.available === true || (availability.available === false && availability.bookedBy === this.currentUserUid);
    //
    //    Opción 2: NO permitir seleccionar ninguna fecha reservada (más restrictivo para el calendario de reserva)
    //    return availability.available === true;
  };


  async proceedToCheckout(): Promise<void> {
    console.log('CarritoComponent: Iniciando proceedToCheckout...');

    if (!this.currentUserUid) {
      alert('Debes iniciar sesión para proceder con la reserva.');
      this.router.navigate(['/auth']);
      return;
    }

    if (!this.cartItemsArray || this.cartItemsArray.length === 0) {
      alert('Tu carrito está vacío. Añade servicios antes de proceder.');
      console.warn('CarritoComponent: Abortando checkout porque cartItemsArray está vacío.');
      return;
    }

    if (!this.selectedReservationDate) {
      alert('Por favor, selecciona una fecha para tu reserva.');
      console.warn('CarritoComponent: Abortando checkout porque selectedReservationDate está vacío.');
      return;
    }

    // ¡CAMBIOS AQUÍ! Verificar que la fecha seleccionada no esté ya reservada por otro
    const formattedDate = this.formatDateToYYYYMMDD(this.selectedReservationDate);
    const selectedDayAvailability = this.allAvailabilityMap[formattedDate];

    // Si el día está reservado y no es por el usuario actual
    if (selectedDayAvailability && selectedDayAvailability.available === false && selectedDayAvailability.bookedBy !== this.currentUserUid) {
      alert('La fecha seleccionada ya ha sido reservada por otro usuario. Por favor, elige otra fecha.');
      console.warn('CarritoComponent: Abortando checkout, fecha ya reservada por otro.');
      return;
    }

    try {
      const reservationItems: ReservationItem[] = this.cartItemsArray.map(cartItem => ({
        id: cartItem.id,
        nombre: cartItem.nombre, // Corrected this, should be cartItem.nombre
        descripcion: cartItem.descripcion,
        precio: cartItem.precio,
        cantidad: cartItem.cantidad,
        imagen: cartItem.imagen,
        categoria: cartItem.categoria,
        duracion: cartItem.duracion
      }));

      console.log('CarritoComponent: Preparando ítems para la reserva:', reservationItems);

      console.log('CarritoComponent: Guardando reserva...');
      const reservationId = await this.firebaseService.saveReservation(
        this.currentUserUid,
        formattedDate,
        reservationItems,
        this.totalCarrito
      );

      console.log('CarritoComponent: Limpiando carrito de Firebase después de la reserva exitosa...');
      await this.firebaseService.guardarCarritoUsuario(this.currentUserUid, {});
      this.cart = { items: {}, total: 0 };
      this.selectedReservationDate = null; // Limpiar el valor del datepicker

      alert(`¡Reserva realizada con éxito! ID de la reserva: ${reservationId}. Puedes ver tus reservas en la Agenda.`);
      this.router.navigate(['/agenda']);
    } catch (error: any) {
      console.error('CarritoComponent: Error al procesar la reserva:', error);
      alert(error.message || 'Hubo un error inesperado al procesar tu reserva. Por favor, intenta de nuevo.');
    }
  }
}
