// src/app/servicios/servicios.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Auth, User } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Servicio } from '../models/servicio.model';

@Component({
  selector: 'app-servicios',
  templateUrl: './servicios.component.html',
  styleUrls: ['./servicios.component.css'],
  standalone: true,
  imports: [CommonModule, RouterLink]
})
export class ServiciosComponent implements OnInit, OnDestroy {
  private authService: AuthService = inject(AuthService);
  private firebaseService: FirebaseService = inject(FirebaseService);
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);
  private route: ActivatedRoute = inject(ActivatedRoute);

  currentUserUid: string | null = null;
  currentCategory: string = '';

  // Vuelven las propiedades para el HTML
  fotos: Servicio[] = [];
  videos: Servicio[] = [];
  extras: Servicio[] = [];
  sugeridos: Servicio[] = []; // Si tienes una sección para "sugeridos" en tu HTML

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

    this.subscriptions.add(
      this.route.paramMap.subscribe(params => {
        this.currentCategory = params.get('categoria') || '';
        if (this.currentCategory) {
          this.fetchServicesByCategory(this.currentCategory);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private fetchServicesByCategory(categoria: string) {
    let servicesObservable;

    switch (categoria) {
      case 'casamientos':
        servicesObservable = this.firebaseService.getServiciosCasamientos();
        break;
      case 'cumpleanos':
        servicesObservable = this.firebaseService.getServiciosCumpleanos();
        break;
      case 'extras':
        servicesObservable = this.firebaseService.getExtras();
        break;
      case 'sugeridos':
        servicesObservable = this.firebaseService.getServiciosSugeridos();
        break;
      default:
        console.error(`Categoría desconocida: ${categoria}`);
        // Limpiar todos los arrays si la categoría no es válida
        this.fotos = [];
        this.videos = [];
        this.extras = [];
        this.sugeridos = [];
        return;
    }

    this.subscriptions.add(
      servicesObservable.subscribe(services => {
        // Asignar los servicios a sus respectivos arrays
        this.fotos = services.filter(s => s.categoria === 'foto');
        this.videos = services.filter(s => s.categoria === 'video');
        this.extras = services.filter(s => s.categoria === 'extra');
        this.sugeridos = services.filter(s => s.categoria === 'sugerido'); // Si lo usas

        console.log(`ServiciosComponent: Servicios para la categoría "${categoria}" cargados y filtrados.`);
        console.log('Fotos:', this.fotos.length);
        console.log('Videos:', this.videos.length);
        console.log('Extras:', this.extras.length);
        this.calculateTotalCart();
      }, error => {
        console.error("ServiciosComponent: Error al cargar los servicios:", error);
      })
    );
  }

  isInCart(serviceId: string): boolean {
    return this.serviciosEnCarrito.has(serviceId);
  }

  async toggleCart(servicio: Servicio): Promise<void> {
    if (!this.currentUserUid) {
      console.warn('Necesitas iniciar sesión para agregar ítems al carrito.');
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
    // Debes sumar los precios de todos los servicios, no solo de una categoría
    const allServices = [...this.fotos, ...this.videos, ...this.extras, ...this.sugeridos];
    if (allServices.length > 0 && this.serviciosEnCarrito.size > 0) {
      this.serviciosEnCarrito.forEach(serviceId => {
        const servicio = allServices.find(s => s.id === serviceId);
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
