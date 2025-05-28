// src/app/carrito/carrito.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest, of } from 'rxjs';
import { switchMap, map, tap } from 'rxjs/operators'; // Importa 'tap' para depuración

import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Servicio } from '../models/servicio.model';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-carrito',
  templateUrl: './carrito.component.html',
  styleUrls: ['./carrito.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class CarritoComponent implements OnInit, OnDestroy {
  private authService: AuthService = inject(AuthService);
  private firebaseService: FirebaseService = inject(FirebaseService);

  carritoItems: Servicio[] = [];
  totalCarrito: number = 0;
  private subscriptions: Subscription = new Subscription();

  private allAvailableServices: Servicio[] = [];
  currentUser: User | null = null;

  ngOnInit(): void {
    console.log("CarritoComponent: ngOnInit - Iniciando carga de servicios y carrito.");

    // 1. Cargar todos los servicios disponibles una vez
    this.subscriptions.add(
      this.firebaseService.getServicios().pipe(
        tap(services => console.log("CarritoComponent: getServicios - Todos los servicios disponibles cargados:", services))
      ).subscribe(
        (services: Servicio[]) => {
          this.allAvailableServices = services;
          this.loadUserCart(); // Luego de cargar todos los servicios, carga el carrito del usuario
        },
        (error: any) => {
          console.error("CarritoComponent: Error al cargar todos los servicios disponibles:", error);
        }
      )
    );
  }

  ngOnDestroy(): void {
    console.log("CarritoComponent: ngOnDestroy - Desuscribiendo todos los observables.");
    this.subscriptions.unsubscribe();
  }

  private loadUserCart(): void {
    console.log("CarritoComponent: loadUserCart - Intentando cargar el carrito del usuario.");

    this.subscriptions.add(
      this.authService.user$.pipe(
        tap(user => {
          this.currentUser = user;
          console.log("CarritoComponent: AuthService.user$ emitido - Usuario:", user ? user.uid : 'No logueado');
        }),
        switchMap(user => {
          if (user && user.uid) {
            console.log(`CarritoComponent: Usuario logueado (${user.uid}), obteniendo carrito de Firebase.`);
            return this.firebaseService.obtenerCarritoUsuario(user.uid).pipe(
              tap(carrito => console.log("CarritoComponent: FirebaseService.obtenerCarritoUsuario - Carrito recibido de Firebase:", carrito))
            );
          } else {
            console.log("CarritoComponent: Usuario no logueado, intentando cargar carrito de localStorage.");
            const localCartString = localStorage.getItem('carrito');
            const localCart = localCartString ? JSON.parse(localCartString) : {};
            console.log("CarritoComponent: Carrito de localStorage:", localCart);
            return of(localCart).pipe(
              tap(localCartData => console.log("CarritoComponent: Carrito de localStorage (Observable):", localCartData))
            );
          }
        }),
        map((carritoObject: { [serviceId: string]: number }) => {
          console.log("CarritoComponent: Mapeando carritoObject a Servicio[] - Carrito Object:", carritoObject);
          const items: Servicio[] = [];
          for (const serviceId in carritoObject) {
            const foundService = this.allAvailableServices.find(s => s.id === serviceId);
            if (foundService) {
              items.push(foundService);
              console.log(`CarritoComponent: Añadiendo servicio al carrito: ${foundService.nombre} (ID: ${foundService.id})`);
            } else {
              console.warn(`CarritoComponent: Servicio con ID ${serviceId} encontrado en carrito pero NO en allAvailableServices.`);
            }
          }
          return items;
        })
      ).subscribe(
        (items: Servicio[]) => {
          this.carritoItems = items;
          this.calculateTotal();
          console.log("CarritoComponent: Carrito Items finalmente cargados:", this.carritoItems);
          if (this.carritoItems.length === 0 && this.currentUser) {
            console.warn("CarritoComponent: El carrito está vacío aunque el usuario esté logueado. Verificar datos en Firebase.");
          }
        },
        (error: any) => {
          console.error("CarritoComponent: Error al cargar el carrito del usuario:", error);
        }
      )
    );
  }

  async removeFromCart(item: Servicio): Promise<void> {
    console.log(`CarritoComponent: Intentando quitar ${item.nombre} (ID: ${item.id}) del carrito.`);
    if (this.currentUser && this.currentUser.uid) {
      try {
        await this.firebaseService.quitarDelCarrito(this.currentUser.uid, item.id);
        console.log(`CarritoComponent: Servicio ${item.nombre} quitado del carrito en Firebase.`);
        // No es necesario recargar loadUserCart(), el listener de Firebase lo hará
      } catch (error) {
        console.error("CarritoComponent: Error al quitar servicio de Firebase:", error);
        alert("Hubo un error al quitar el servicio del carrito.");
      }
    } else {
      const localCartString = localStorage.getItem('carrito');
      let localCartObject: { [key: string]: number } = localCartString ? JSON.parse(localCartString) : {};
      delete localCartObject[item.id];
      localStorage.setItem('carrito', JSON.stringify(localCartObject));
      this.loadUserCart(); // Recargar para actualizar la vista local
      console.log(`CarritoComponent: Servicio ${item.nombre} quitado del carrito local.`);
    }
  }

  private calculateTotal(): void {
    this.totalCarrito = this.carritoItems.reduce((sum, item) => sum + item.precio, 0);
    console.log("CarritoComponent: Total del carrito calculado:", this.totalCarrito);
  }

  async checkout(): Promise<void> {
    console.log('CarritoComponent: Procediendo al checkout...');
    if (this.currentUser && this.currentUser.uid) {
      const carritoToSave: { [key: string]: number } = {};
      this.carritoItems.forEach(item => {
        if (item.id && item.precio) {
          carritoToSave[item.id] = item.precio;
        }
      });

      if (Object.keys(carritoToSave).length === 0) {
        alert('Tu carrito está vacío, no hay nada que finalizar.');
        console.warn("CarritoComponent: Checkout cancelado, carrito vacío.");
        return;
      }

      try {
        await this.firebaseService.guardarCarritoUsuario(this.currentUser.uid, carritoToSave);
        alert('Tu pedido ha sido procesado y guardado en Firebase.');
        this.clearCart();
        console.log("CarritoComponent: Pedido procesado y carrito limpiado.");
      } catch (error) {
        console.error("CarritoComponent: Error al guardar el carrito en Firebase:", error);
        alert("Hubo un error al procesar tu pedido.");
      }
    } else {
      alert('Por favor, inicia sesión para finalizar tu compra.');
      console.warn("CarritoComponent: Checkout cancelado, usuario no logueado.");
    }
  }

  clearCart(): void {
    console.log("CarritoComponent: Intentando vaciar el carrito.");
    this.carritoItems = [];
    this.totalCarrito = 0;
    if (this.currentUser && this.currentUser.uid) {
      this.firebaseService.guardarCarritoUsuario(this.currentUser.uid, {});
      console.log("CarritoComponent: Carrito de Firebase limpiado.");
    } else {
      localStorage.removeItem('carrito');
      console.log("CarritoComponent: Carrito de localStorage limpiado.");
    }
  }

  generarResumenPedido(): string {
    if (this.carritoItems.length === 0) {
      return "Tu carrito está vacío.";
    }

    let resumen = "¡Hola! Mi pedido es el siguiente:\n\n";
    this.carritoItems.forEach(item => {
      resumen += `- ${item.nombre} ($${item.precio})\n`;
    });
    resumen += `\nTotal: $${this.totalCarrito}`;

    return encodeURIComponent(resumen);
  }
}
