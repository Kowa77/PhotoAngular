// src/app/carrito/carrito.component.ts

import { Component, OnInit, OnDestroy, inject, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// ¡CAMBIOS AQUÍ! Importa los módulos de Angular Material para el Datepicker
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Subscription, combineLatest, of, BehaviorSubject } from 'rxjs'; // Añadido BehaviorSubject
import { switchMap, tap, catchError, map, distinctUntilChanged, filter } from 'rxjs/operators'; // Añadido distinctUntilChanged, filter
import { Cart, CartItem } from '../models/cart.model';
import { ReservationItem, DailyAvailabilityMap } from '../models/reservation.model';
import { Servicio } from '../models/servicio.model';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule, // Angular Material Datepicker
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './carrito.component.html',
  styleUrls: ['./carrito.component.css'],
  // No necesitamos ViewEncapsulation.None ni ChangeDetectionStrategy.OnPush si no los tenías antes,
  // pero los mantendremos si la idea es optimizar.
  // encapsulation: ViewEncapsulation.None,
  // changeDetection: ChangeDetectionStrategy.OnPush
})
export class CarritoComponent implements OnInit, OnDestroy {
  private firebaseService: FirebaseService = inject(FirebaseService);
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);

  cart: Cart | null = null;
  public currentUserUid: string | null = null; // Public para posible uso en template si se necesita mostrar

  // Añadimos un estado de carga y un Subject para gestionar el UID del usuario
  public isLoading: boolean = true; // Hacemos 'public' para que sea accesible en la plantilla.
  private userUidSubject = new BehaviorSubject<string | null>(null); // Inicializado con null

  private mainSubscription: Subscription | null = null;
  private availabilitySubscription: Subscription | null = null;

  selectedReservationDate: Date | null = null; // Para Angular Material Datepicker
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
    // this.selectedReservationDate = today; // No inicializar aquí, ya que el Datepicker lo maneja
  }

  ngOnInit(): void {
    console.log('CarritoComponent: ngOnInit - Iniciando carga de carrito.');
    this.isLoading = true; // Iniciar con estado de carga

    // Suscribirse al usuario de autenticación
    this.authService.user$.pipe(
      tap(user => {
        this.currentUserUid = user ? user.uid : null;
        console.log('CarritoComponent: currentUserUid recibido:', this.currentUserUid);
        this.userUidSubject.next(this.currentUserUid); // Emitir el UID a nuestro Subject
      }),
      distinctUntilChanged() // Evitar emisiones duplicadas del UID
    ).subscribe();

    // La suscripción principal ahora espera que el UID del usuario sea conocido
    this.mainSubscription = this.userUidSubject.pipe(
      filter(uid => uid !== undefined), // Esperar hasta que el UID no sea undefined (puede ser null)
      tap(uid => console.log('CarritoComponent: userUidSubject emitió:', uid)),
      switchMap(uid => {
        if (!uid) {
          console.log('CarritoComponent: No hay usuario autenticado (userUidSubject), combineLatest recibirá observables vacíos.');
          return of({ cartData: {} as Record<string, number>, allServicios: [] as Servicio[] });
        }

        console.log(`CarritoComponent: Usuario UID ${uid} conocido. Procediendo a cargar datos.`);
        return combineLatest([
          this.firebaseService.obtenerCarritoUsuario(uid).pipe(
            tap(data => console.log('CarritoComponent: Raw cartData received from FirebaseService:', data)),
            catchError(error => {
              console.error('CarritoComponent: Error fetching user cart:', error);
              return of({} as Record<string, number>);
            })
          ),
          this.firebaseService.getTodosLosServicios().pipe(
            tap(data => console.log('CarritoComponent: allServicios loaded (from combineLatest):', data)),
            catchError(error => {
              console.error('CarritoComponent: Error fetching all services:', error);
              return of([] as Servicio[]);
            })
          )
        ]).pipe(
          map(([cartData, allServicios]: [Record<string, number>, Servicio[]]) => ({ cartData, allServicios })),
          tap(() => console.log('CarritoComponent: combineLatest emitió datos para procesamiento.')),
          catchError(error => {
            console.error('CarritoComponent: Error en combineLatest:', error);
            this.isLoading = false; // Finalizar estado de carga en caso de error
            return of({ cartData: {}, allServicios: [] });
          })
        );
      })
    ).subscribe(
      ({ cartData, allServicios }) => {
        // Solo procesamos si el currentUserUid es el que esperamos (para evitar condiciones de carrera)
        if (!this.currentUserUid) {
          console.log('CarritoComponent: Procesamiento final abortado, currentUserUid es null/desconocido.');
          this.setEmptyCart();
          this.isLoading = false;
          return;
        }

        console.log('CarritoComponent: Processing with cartData and allServicios.');
        console.log('     cartData (final):', cartData);
        console.log('     allServicios (final):', allServicios);

        if (cartData && Object.keys(cartData).length > 0 && allServicios && allServicios.length > 0) {
          const items: { [serviceId: string]: CartItem } = {};
          let total = 0;
          let itemsProcessedCount = 0;

          for (const serviceId in cartData) {
            if (cartData.hasOwnProperty(serviceId)) {
              const cantidad = (cartData as Record<string, number>)[serviceId];
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
                  duracion: typeof servicio.duracion === 'string' ? Number(servicio.duracion) : servicio.duracion ?? null
                };
                total += servicio.precio * cantidad; // Suma el precio real * cantidad
                itemsProcessedCount++;
              } else {
                console.warn(`CarritoComponent: Service with ID ${serviceId} from cart not found in all services. It will NOT be added to the visible cart.`);
              }
            }
          }
          this.cart = { items, total };
          this.updateCartDisplayData();
          console.log(`CarritoComponent: Successfully processed ${itemsProcessedCount} items. Final visible cart:`, this.cart);
        } else {
          console.log('CarritoComponent: CartData o allServicios están vacíos/nulos, estableciendo carrito como vacío localmente.');
          this.setEmptyCart();
        }
        this.isLoading = false; // ¡Finalizar estado de carga SÓLO aquí!
        console.log('CarritoComponent: After update, cartItemsArray.length is:', this.cartItemsArray.length);
      },
      (error) => {
        console.error('CarritoComponent: Major error in main subscription:', error);
        this.setEmptyCart();
        this.isLoading = false; // Finalizar estado de carga en caso de error
      }
    );

    // Cargar allAvailabilityMap para el calendario global
    this.availabilitySubscription = this.firebaseService.allReservations$().pipe(
      tap(data => console.log('CarritoComponent: Daily availability data received:', data)),
      catchError(error => {
        console.error('CarritoComponent: Error fetching daily availability:', error);
        return of({});
      }),
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
    this.userUidSubject.complete(); // Completar el Subject al destruir
  }

  private setEmptyCart(): void {
    this.cart = { items: {}, total: 0 };
    this.updateCartDisplayData();
    console.log('CarritoComponent: setEmptyCart called. cartItemsArray:', this.cartItemsArray.length, 'Total:', this.currentCartTotal);
  }

  private updateCartDisplayData(): void {
    this.cartItemsArray = this.cart ? Object.values(this.cart.items) : [];
    this.currentCartTotal = this.cart ? this.cart.total : 0;
    console.log('CarritoComponent: Cart display data updated. Items:', this.cartItemsArray.length, 'Total:', this.currentCartTotal);
  }

  trackByItemId(index: number, item: CartItem): string {
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

  private formatDateToYYYYMMDD(date: Date): string { // Tipo Date para Angular Material
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // CAMBIO EN onDateSelect para manejar el evento de MatDatepicker
  onDateSelect(event: any): void {
    this.selectedReservationDate = event.value; // event.value es de tipo Date
    console.log('Fecha seleccionada del Datepicker (Angular Material):', this.selectedReservationDate);
  }

  // CAMBIO EN dateClass para manejar el tipo Date de Angular Material
  dateClass = (date: Date): string => {
    const formattedDate = this.formatDateToYYYYMMDD(date);
    const availability = this.allAvailabilityMap[formattedDate];
    let classes = '';

    if (availability && availability.available === false) {
      if (this.currentUserUid && availability.bookedBy === this.currentUserUid) {
        classes += ' booked-by-current-user';
      } else {
        classes += ' booked-by-others';
      }
    }
    return classes.trim();
  };

  // CAMBIO EN dateFilter para manejar el tipo Date de Angular Material
  dateFilter = (date: Date | null): boolean => {
    if (!date) {
      return false;
    }

    const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (currentDate < today) {
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
    console.log('CarritoComponent: Starting proceedToCheckout...');

    if (!this.currentUserUid) {
      console.warn('You must log in to proceed with the reservation.');
      this.router.navigate(['/auth']);
      return;
    }

    if (!this.cartItemsArray || this.cartItemsArray.length === 0) {
      console.warn('Your cart is empty. Add services before proceeding.');
      return;
    }

    if (!this.selectedReservationDate) {
      console.warn('Please select a date for your reservation.');
      return;
    }

    const formattedDate = this.formatDateToYYYYMMDD(this.selectedReservationDate);
    const selectedDayAvailability = this.allAvailabilityMap[formattedDate];

    if (selectedDayAvailability && selectedDayAvailability.available === false && selectedDayAvailability.bookedBy !== this.currentUserUid) {
      console.warn('The selected date has already been reserved by another user. Please choose another date.');
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
        duracion: cartItem.duracion ?? null // Aseguramos null si es undefined
      }));

      console.log('CarritoComponent: Preparing items for reservation:', reservationItems);
      console.log('CarritoComponent: Saving reservation...');

      const reservationId = await this.firebaseService.saveReservation(
        this.currentUserUid,
        formattedDate,
        reservationItems,
        this.currentCartTotal
      );

      console.log('CarritoComponent: Clearing Firebase cart after successful reservation...');
      await this.firebaseService.guardarCarritoUsuario(this.currentUserUid, {});
      this.setEmptyCart();
      this.selectedReservationDate = null; // Limpiar el valor del datepicker

      console.log(`Reservation successfully made! Reservation ID: ${reservationId}. You can view your reservations in the Agenda.`);
      this.router.navigate(['/agenda']);
    } catch (error: any) {
      console.error('CarritoComponent: Error processing reservation:', error);
      console.error(error.message || 'There was an unexpected error processing your reservation. Please try again.');
    }
  }
}
