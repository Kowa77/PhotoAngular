// src/app/servicios/servicios.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Auth, User } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firefirebase-service.service';
import { Servicio } from '../models/servicio.model';

declare const Swal: any;

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

  selectedDurations: { [serviceId: string]: number } = {};

  currentUserUid: string | null = null;
  currentCategory: string = '';

  // Vuelven las propiedades para el HTML
  fotos: Servicio[] = [];
  videos: Servicio[] = [];
  extras: Servicio[] = [];
  sugeridos: Servicio[] = []; // Si tienes una sección para "sugeridos" en tu HTML

  servicios: Servicio[] = []; // Todos los servicios cargados
  serviciosEnCarrito: Set<string> = new Set();
  totalCarrito: number = 0;

  private subscriptions: Subscription = new Subscription();

  ngOnInit() {
    this.subscriptions.add(
      this.authService.user$.subscribe(user => {
        this.currentUserUid = user ? user.uid : null;
        //console.log("ServiciosComponent: Usuario logueado:", this.currentUserUid);

        if (this.currentUserUid) {
          this.subscriptions.add(
            this.firebaseService.obtenerCarritoUsuario(this.currentUserUid).subscribe(carrito => {
              this.serviciosEnCarrito = new Set(Object.keys(carrito || {}));
              this.calculateTotalCart();
              //console.log("ServiciosComponent: Carrito del usuario actualizado:", this.serviciosEnCarrito);
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

fetchServicesByCategory(category: string): void {
  //console.log(`fetchServicesByCategory: iniciando carga para categoría =>`, category);

  // 🔧 Normalizamos la categoría (sin tildes, todo en minúscula)
  const normalize = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const cat = normalize(category);

  if (cat === 'casamientos') {
    this.subscriptions.add(
      this.firebaseService.getServiciosCasamientos().subscribe(data => {
        this.servicios = data;
        this.fotos = data.filter(s => s.categoria === 'foto');
        this.videos = data.filter(s => s.categoria === 'video');

        //console.log(`fetchServicesByCategory: servicios casamientos cargados =>`, data);
        //console.log(`fetchServicesByCategory: total recibidos =>`, data.length);
      })
    );
  } else if (cat === 'cumpleanos') {
    this.subscriptions.add(
      this.firebaseService.getServiciosCumpleanos().subscribe(data => {
        this.servicios = data;
        this.fotos = data.filter(s => s.categoria === 'foto');
        this.videos = data.filter(s => s.categoria === 'video');

        //console.log(`fetchServicesByCategory: servicios cumpleaños cargados =>`, data);
        //console.log(`fetchServicesByCategory: total recibidos =>`, data.length);
      })
    );
  } else if (cat === 'sugeridos') {
    this.subscriptions.add(
      this.firebaseService.getServiciosSugeridos().subscribe(data => {
        this.servicios = data;

        //console.log(`fetchServicesByCategory: servicios sugeridos cargados =>`, data);
        //console.log(`fetchServicesByCategory: total recibidos =>`, data.length);
      })
    );
  } else if (cat === 'extras') {
    this.subscriptions.add(
      this.firebaseService.getExtras().subscribe(data => {
        this.servicios = data;
        this.extras = data.filter(s => s.categoria === 'extra');

        //console.log(`fetchServicesByCategory: servicios extras cargados =>`, data);
        //console.log(`fetchServicesByCategory: total recibidos =>`, data.length);
      })
    );
  } else {
    console.warn(`fetchServicesByCategory: categoría no reconocida =>`, category);
  }
}





  isInCart(serviceId: string): boolean {
    return this.serviciosEnCarrito.has(serviceId);
  }

  async toggleCart(servicio: Servicio): Promise<void> {
  if (!this.currentUserUid) {
    Swal.fire({
      icon: 'warning',
      title: 'Debes iniciar sesión',
      text: 'Para agregar o quitar servicios, por favor inicia sesión primero.',
    });
    return;
  }

  try {
    if (this.isInCart(servicio.id)) {
      await this.firebaseService.quitarDelCarrito(this.currentUserUid, servicio.id);
      console.log(`Servicio ${servicio.nombre} quitado del carrito.`);
      Swal.fire({
        icon: 'success',
        title: '¡Eliminado!',
        text: `El servicio "${servicio.nombre}" ha sido quitado de tu carrito.`,
        showConfirmButton: false,
        timer: 1500
      });
    } else {
      await this.firebaseService.addToCart(this.currentUserUid, servicio);
      console.log(`Servicio ${servicio.nombre} agregado al carrito.`);
      Swal.fire({
        icon: 'success',
        title: '¡Agregado!',
        text: `El servicio "${servicio.nombre}" ha sido agregado a tu carrito.`,
        showConfirmButton: false,
        timer: 1500
      });
    }
  } catch (error) {
    console.error('Error en la operación del carrito:', error);
    Swal.fire({
      icon: 'error',
      title: 'Oops...',
      text: 'Hubo un error al actualizar el carrito. Por favor, inténtalo de nuevo.',
    });
  }
  }

  calculateTotalCart(): void {
    let total = 0;
    // Debes sumar los precios de todos los servicios, no solo de una categoría
    const allServices = this.servicios;
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
      console.log('Sesión cerrada.');
      Swal.fire('Sesión cerrada.')
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  verCarrito(): void {
    this.router.navigate(['/carrito']);
  }

  onDurationChange(serviceId: string, hours: number): void {
    this.selectedDurations[serviceId] = hours;
    console.log(`Duración seleccionada para ${serviceId}: ${hours} horas`);
  }

  async addToCart(servicio: Servicio): Promise<void> {
  const duration = this.selectedDurations[servicio.id] ?? 1;

  if (this.currentUserUid) {
    await this.firebaseService.addToCart(this.currentUserUid, servicio, duration);
    console.log(`Servicio ${servicio.id} agregado al carrito con duración ${duration} horas`);
  }
}



}
