import { Component, OnInit, OnDestroy, inject, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Router } from '@angular/router';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Subscription, combineLatest, of, BehaviorSubject } from 'rxjs';
import { switchMap, tap, catchError, map, distinctUntilChanged, filter } from 'rxjs/operators';
import { Cart, CartItem } from '../models/cart.model';
import { ReservationItem, DailyAvailabilityMap } from '../models/reservation.model';
import { Servicio } from '../models/servicio.model';
import { AuthService } from '../auth/auth.service';

// Importa los módulos de Material aquí
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';



@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule
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
  public currentUserUid: string | null = null;

  public isLoading: boolean = true;
  private userUidSubject = new BehaviorSubject<string | null>(null);

  private mainSubscription: Subscription | null = null;
  private availabilitySubscription: Subscription | null = null;

  selectedDate: Date | null = null;
  selectedReservationDate: Date | null = null;
  startAt: Date;
  minDate: Date;
  maxDate: Date;

  allAvailabilityMap: DailyAvailabilityMap = {};

  cartItemsArray: CartItem[] = [];
  currentCartTotal: number = 0;

  constructor() {
    const today = new Date();
    this.minDate = new Date(today.getFullYear(), 0, 1);
    this.startAt = today;
    this.maxDate = new Date();
    this.maxDate.setFullYear(this.maxDate.getFullYear() + 2);
  }

  ngOnInit(): void {
    console.log('CarritoComponent: ngOnInit - Iniciando carga de carrito.');
    this.isLoading = true;

    this.authService.user$.pipe(
      tap(user => {
        this.currentUserUid = user ? user.uid : null;
        console.log('CarritoComponent: currentUserUid recibido:', this.currentUserUid);
        this.userUidSubject.next(this.currentUserUid);
      }),
      distinctUntilChanged()
    ).subscribe();

    this.mainSubscription = this.userUidSubject.pipe(
      filter(uid => uid !== undefined),
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
            this.isLoading = false;
            return of({ cartData: {}, allServicios: [] });
          })
        );
      })
    ).subscribe(
      ({ cartData, allServicios }) => {
        if (!this.currentUserUid) {
          console.log('CarritoComponent: Procesamiento final abortado, currentUserUid es null/desconocido.');
          this.setEmptyCart();
          this.isLoading = false;
          return;
        }

        console.log('CarritoComponent: Processing with cartData and allServicios.');
        console.log('     cartData (final):', cartData);
        console.log('     allServicios (final):', allServicios);

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
                total += servicio.precio * cantidad;
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
        this.isLoading = false;
        console.log('CarritoComponent: After update, cartItemsArray.length is:', this.cartItemsArray.length);
      },
      (error) => {
        console.error('CarritoComponent: Major error in main subscription:', error);
        this.setEmptyCart();
        this.isLoading = false;
      }
    );

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
    this.userUidSubject.complete();
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

  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onDateSelect(event: any): void {
    this.selectedReservationDate = event.value;
    console.log('Fecha seleccionada del Datepicker (Angular Material):', this.selectedReservationDate);
  }

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

  // LÓGICA DE FILTRADO ACTUALIZADA: INHABILITA TODOS LOS DÍAS RESERVADOS
  dateFilter = (date: Date | null): boolean => {
    if (!date) {
      return false;
    }

    const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Siempre deshabilita días pasados
    if (currentDate < today) {
      return false;
    }

    const formattedDate = this.formatDateToYYYYMMDD(date);
    const availability = this.allAvailabilityMap[formattedDate];

    // Si no hay disponibilidad registrada, el día está disponible
    if (!availability) {
      return true;
    }

    // Retorna `true` solo si el día está explícitamente disponible
    // Esto inhabilita tanto las reservas propias como las de otros
    return availability.available === true;
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

    // Esta validación es un seguro adicional, pero la lógica de dateFilter ya lo evita
    if (selectedDayAvailability && selectedDayAvailability.available === false) {
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
        duracion: cartItem.duracion ?? null
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
      Swal.fire("SweetAlert2 is working!");
      await this.firebaseService.guardarCarritoUsuario(this.currentUserUid, {});
      this.setEmptyCart();
      this.selectedReservationDate = null;

      console.log(`Reservation successfully made! Reservation ID: ${reservationId}. You can view your reservations in the Agenda.`);
      this.router.navigate(['/agenda']);
    } catch (error: any) {
      console.error('CarritoComponent: Error processing reservation:', error);
      console.error(error.message || 'There was an unexpected error processing your reservation. Please try again.');
    }
  }
}
