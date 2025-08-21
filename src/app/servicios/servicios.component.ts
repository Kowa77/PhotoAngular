// src/app/servicios/servicios.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router'; // Importa RouterLink también si lo usas en el template
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
  imports: [CommonModule] // Asegúrate de que RouterLink esté aquí si lo usas en el template
})
export class ServiciosComponent implements OnInit, OnDestroy {
  private authService: AuthService = inject(AuthService);
  private firebaseService: FirebaseService = inject(FirebaseService);
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);

  currentUserUid: string | null = null;
  allAvailableServices: Servicio[] = []; // Contendrá todos los servicios combinados

  // Si necesitas separarlos, puedes usar estos, o quizás adaptarlos a las nuevas categorías (casamientos, cumpleaños, sugeridos, extras)
  fotos: Servicio[] = [];
  videos: Servicio[] = [];
  extras: Servicio[] = [];
  sugeridos: Servicio[] = []; // Nueva propiedad para los servicios sugeridos
  casamientos: Servicio[] = []; // Nueva propiedad para los servicios de casamientos
  cumpleanos: Servicio[] = []; // Nueva propiedad para los servicios de cumpleaños

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
    // Ahora usamos el nuevo método getTodosLosServicios() que combina todo
    this.subscriptions.add(
      this.firebaseService.getTodosLosServicios().subscribe(allServices => {
        this.allAvailableServices = allServices;
        console.log("ServiciosComponent: Todos los servicios cargados:", this.allAvailableServices);

        // Opcional: Si tu template sigue necesitando las categorías separadas (fotos, videos, extras, sugeridos, etc.)
        // Puedes filtrarlos aquí o refactorizar tu template para usar directamente allAvailableServices
        this.fotos = allServices.filter(s => s.categoria === 'foto');
        this.videos = allServices.filter(s => s.categoria === 'video');
        this.extras = allServices.filter(s => s.categoria === 'extra');
        this.sugeridos = allServices.filter(s => s.categoria === 'sugerido');

        // Para los servicios de casamientos/cumpleaños, necesitas decidir cómo los quieres categorizar aquí.
        // Si tu UI los agrupa por "tipo" (foto/video) dentro de "evento" (casamientos/cumpleaños),
        // podrías necesitar lógica más compleja o simplemente mostrar toda la lista y dejar que el usuario filtre.
        // Por ahora, 'fotos', 'videos', 'extras', 'sugeridos' se basan en la propiedad 'categoria' que mapea tu servicio.
        // Si quieres 'casamientos' y 'cumpleaños' como listas separadas, necesitarías ajustar el mapeo en FirebaseService
        // para que cada servicio tenga una propiedad 'evento' (ej. 'casamiento', 'cumpleaños').

        this.calculateTotalCart(); // Recalcula el total del carrito con todos los servicios
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
      // Usar un modal en lugar de alert
      console.warn('Necesitas iniciar sesión para agregar ítems al carrito.');
      // Aquí podrías abrir un modal informativo para el usuario
      return;
    }

    if (this.isInCart(servicio.id)) {
      await this.firebaseService.quitarDelCarrito(this.currentUserUid, servicio.id);
      console.log(`ServiciosComponent: Servicio ${servicio.nombre} quitado del carrito.`);
    } else {
      await this.firebaseService.addToCart(this.currentUserUid, servicio);
      console.log(`ServiciosComponent: Servicio ${servicio.nombre} agregado al carrito.`);
    }
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

  verCarrito(): void {
    this.router.navigate(['/carrito']);
  }
}
