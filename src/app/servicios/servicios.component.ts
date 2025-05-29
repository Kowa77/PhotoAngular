// src/app/servicios/servicios.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router'; // Importa Router
import { Auth, User } from '@angular/fire/auth';
import { Subscription, combineLatest } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Servicio } from '../models/servicio.model';

@Component({
  selector: 'app-servicios',
  templateUrl: './servicios.component.html',
  styleUrls: ['./servicios.component.css'],
  standalone: true,
  imports: [CommonModule, RouterLink] // Añade RouterLink a imports
})
export class ServiciosComponent implements OnInit, OnDestroy {
  private authService: AuthService = inject(AuthService);
  private firebaseService: FirebaseService = inject(FirebaseService);
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router); // Inyecta Router para la navegación programática

  currentUserUid: string | null = null;
  allAvailableServices: Servicio[] = [];
  fotos: Servicio[] = [];
  videos: Servicio[] = [];
  extras: Servicio[] = [];
  serviciosEnCarrito: Set<string> = new Set();
  totalCarrito: number = 0;

  private subscriptions: Subscription = new Subscription();

  ngOnInit() {
    this.subscriptions.add(
      this.authService.user$.subscribe(user => {
        this.currentUserUid = user ? user.uid : null;
        console.log("ServiciosComponent: Usuario logueado:", this.currentUserUid);

        if (this.currentUserUid) {
          this.subscriptions.add(
            this.firebaseService.obtenerCarritoUsuario(this.currentUserUid).subscribe(carrito => {
              this.serviciosEnCarrito = new Set(Object.keys(carrito || {}));
              this.calculateTotalCart();
              console.log("ServiciosComponent: Carrito del usuario actualizado:", this.serviciosEnCarrito);
            })
          );
        } else {
          // Lógica para carrito local (localStorage) si no hay usuario logueado
          // Esto ya lo maneja el CarritoComponent, aquí solo vaciamos el Set si no hay usuario.
          this.serviciosEnCarrito = new Set();
          this.calculateTotalCart();
          console.log("ServiciosComponent: Usuario deslogueado, carrito local a considerar vacío para esta vista.");
        }
      })
    );

    this.fetchServices();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private fetchServices() {
    this.subscriptions.add(
      combineLatest([
        this.firebaseService.getFotos(),
        this.firebaseService.getVideos(),
        this.firebaseService.getExtras()
      ]).subscribe(([fotos, videos, extras]) => {
        this.fotos = fotos;
        this.videos = videos;
        this.extras = extras;
        this.allAvailableServices = [...fotos, ...videos, ...extras];
        console.log("ServiciosComponent: Servicios cargados y clasificados:", { fotos, videos, extras });
      }, error => {
        console.error("ServiciosComponent: Error al cargar los servicios:", error);
      })
    );
  }

  // Nuevo método para verificar si un servicio está en el carrito
  isInCart(serviceId: string): boolean {
    return this.serviciosEnCarrito.has(serviceId);
  }

  // Nuevo método para alternar (añadir/quitar) un servicio del carrito
  async toggleCart(servicio: Servicio): Promise<void> {
    if (!this.currentUserUid) {
      alert('Necesitas iniciar sesión para agregar ítems al carrito.');
      return;
    }

    if (this.isInCart(servicio.id)) {
      // Quitar del carrito
      await this.firebaseService.quitarDelCarrito(this.currentUserUid, servicio.id);
      console.log(`ServiciosComponent: Servicio ${servicio.nombre} quitado del carrito.`);
    } else {
      // Agregar al carrito
      // ¡CORRECCIÓN AQUÍ! Llama a addToCart y pasa el objeto 'servicio' completo.
      await this.firebaseService.addToCart(this.currentUserUid, servicio);
      console.log(`ServiciosComponent: Servicio ${servicio.nombre} agregado al carrito.`);
    }
    // La actualización del Set 'serviciosEnCarrito' y el total se hará a través de la suscripción a 'obtenerCarritoUsuario'.
  }

  calculateTotalCart(): void {
    let total = 0;
    if (this.allAvailableServices.length > 0 && this.serviciosEnCarrito.size > 0) {
      this.serviciosEnCarrito.forEach(serviceId => {
        const servicio = this.allAvailableServices.find(s => s.id === serviceId);
        if (servicio) {
          total += servicio.precio;
        }
      });
    }
    this.totalCarrito = total;
    console.log("ServiciosComponent: Total Carrito Actualizado:", this.totalCarrito);
  }

  // Método 'pagar' ahora solo navegará al carrito
  pagar(): void {
    console.log("Navegando al carrito...");
    this.router.navigate(['/carrito']);
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logoutUser();
      console.log('ServiciosComponent: Sesión cerrada.');
    } catch (error) {
      console.error('ServiciosComponent: Error al cerrar sesión:', error);
    }
  }
}
