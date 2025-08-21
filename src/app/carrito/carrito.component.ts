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

  // Propiedades para almacenar los ítems del carrito como un array y el total
  cartItemsArray: CartItem[] = []; // Ahora es una propiedad, no un getter
  currentCartTotal: number = 0; // Ahora es una propiedad, no un getter

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
          this.setEmptyCart(); // Usa el nuevo método para vaciar el carrito
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
          // ¡CAMBIO CLAVE AQUÍ! Usar getTodosLosServicios()
          this.firebaseService.getTodosLosServicios().pipe(
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
          this.setEmptyCart(); // Asegura que el carrito se vacíe
          return;
        }

        console.log('CarritoComponent: Processing with cartData and allServicios.');
        console.log('    cartData:', cartData);
        console.log('    allServicios:', allServicios);

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
          this.updateCartDisplayData(); // Actualiza cartItemsArray y currentCartTotal
          console.log(`CarritoComponent: Successfully processed ${itemsProcessedCount} items. Final visible cart:`, this.cart);
        } else {
          console.log('CarritoComponent: CartData or allServicios is empty/null, setting cart as empty locally.');
          this.setEmptyCart(); // Usa el nuevo método para vaciar el carrito
        }
        console.log('CarritoComponent: After update, cartItemsArray.length is:', this.cartItemsArray.length);
      },
      (error) => {
        console.error('CarritoComponent: Major error in main subscription:', error);
        this.setEmptyCart(); // Asegura que el carrito se vacíe en caso de error mayor
      }
    );

    // Suscribirse a la disponibilidad de todos los días
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

  // Nuevo método para vaciar el carrito de forma consistente
  private setEmptyCart(): void {
    this.cart = { items: {}, total: 0 };
    this.updateCartDisplayData();
  }

  // Nuevo método para actualizar cartItemsArray y currentCartTotal
  private updateCartDisplayData(): void {
    this.cartItemsArray = this.cart ? Object.values(this.cart.items) : [];
    this.currentCartTotal = this.cart ? this.cart.total : 0;
    console.log('CarritoComponent: Cart display data updated. Items:', this.cartItemsArray.length, 'Total:', this.currentCartTotal);
  }

  trackByItemId(index: number, item: CartItem): string { // Agregado 'index' para la firma común de trackBy
    return item.id;
  }

  async updateQuantity(serviceId: string, event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const newQuantity = parseInt(target.value, 10);

    // Asegúrate de que this.cart.items exista antes de intentar iterar
    if (this.currentUserUid && this.cart && this.cart.items && newQuantity >= 1) {
      const currentItem = this.cart.items[serviceId];
      if (currentItem) {
        // Crea una copia del objeto de items para enviar a Firebase
        const updatedFirebaseCart: { [key: string]: number } = {};
        for (const key in this.cart.items) {
          if (this.cart.items.hasOwnProperty(key)) {
            updatedFirebaseCart[key] = this.cart.items[key].cantidad;
          }
        }
        updatedFirebaseCart[serviceId] = newQuantity;

        await this.firebaseService.guardarCarritoUsuario(this.currentUserUid, updatedFirebaseCart);
        console.log(`CarritoComponent: Cantidad de ${serviceId} actualizada a ${newQuantity} en Firebase.`);
        // No es necesario actualizar this.cart.items aquí, la suscripción a obtenerCarritoUsuario lo hará automáticamente.
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

  dateClass = (date: Date): string => {
    const formattedDate = this.formatDateToYYYYMMDD(date);
    const availability = this.allAvailabilityMap[formattedDate];

    if (availability && availability.available === false) {
      if (this.currentUserUid && availability.bookedBy === this.currentUserUid) {
        return 'booked-by-current-user';
      }
      return 'booked-by-others';
    }
    return '';
  };

  dateFilter = (date: Date | null): boolean => {
    if (!date) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      return false;
    }

    const formattedDate = this.formatDateToYYYYMMDD(date);
    const availability = this.allAvailabilityMap[formattedDate];

    if (!availability) {
      return true;
    }

    return availability.available === true || (availability.available === false && availability.bookedBy === this.currentUserUid);
  };

  async proceedToCheckout(): Promise<void> {
    console.log('CarritoComponent: Iniciando proceedToCheckout...');

    if (!this.currentUserUid) {
      // Reemplazado alert por console.warn y redirección, como buena práctica
      console.warn('Debes iniciar sesión para proceder con la reserva.');
      this.router.navigate(['/auth']);
      return;
    }

    if (!this.cartItemsArray || this.cartItemsArray.length === 0) {
      console.warn('Tu carrito está vacío. Añade servicios antes de proceder.');
      // Aquí podrías mostrar un modal de error si tienes uno configurado
      return;
    }

    if (!this.selectedReservationDate) {
      console.warn('Por favor, selecciona una fecha para tu reserva.');
      // Aquí podrías mostrar un modal de error si tienes uno configurado
      return;
    }

    const formattedDate = this.formatDateToYYYYMMDD(this.selectedReservationDate);
    const selectedDayAvailability = this.allAvailabilityMap[formattedDate];

    if (selectedDayAvailability && selectedDayAvailability.available === false && selectedDayAvailability.bookedBy !== this.currentUserUid) {
      console.warn('La fecha seleccionada ya ha sido reservada por otro usuario. Por favor, elige otra fecha.');
      // Aquí podrías mostrar un modal de error si tienes uno configurado
      return;
    }

    try {
      const reservationItems: ReservationItem[] = this.cartItemsArray.map(cartItem => ({
        id: cartItem.id,
        nombre: cartItem.nombre,
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
        this.currentCartTotal // Usar la nueva propiedad
      );

      console.log('CarritoComponent: Limpiando carrito de Firebase después de la reserva exitosa...');
      await this.firebaseService.guardarCarritoUsuario(this.currentUserUid, {});
      this.setEmptyCart(); // Usa el nuevo método para vaciar el carrito
      this.selectedReservationDate = null; // Limpiar el valor del datepicker

      console.log(`¡Reserva realizada con éxito! ID de la reserva: ${reservationId}. Puedes ver tus reservas en la Agenda.`);
      // Aquí podrías mostrar un modal de éxito en lugar de alert
      this.router.navigate(['/agenda']);
    } catch (error: any) {
      console.error('CarritoComponent: Error al procesar la reserva:', error);
      // Reemplazado alert por console.error
      console.error(error.message || 'Hubo un error inesperado al procesar tu reserva. Por favor, intenta de nuevo.');
    }
  }
}
