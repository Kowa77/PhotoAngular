// src/app/servicios/servicios.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Database, ref, child, onValue, DataSnapshot } from '@angular/fire/database';
import { Subscription, Observable, combineLatest } from 'rxjs'; // Importa combineLatest
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firefirebase-service.service';

import { Servicio } from '../models/servicio.model';

@Component({
  selector: 'app-servicios',
  templateUrl: './servicios.component.html',
  styleUrls: ['./servicios.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class ServiciosComponent implements OnInit, OnDestroy {
  private database: Database = inject(Database);
  private authService: AuthService = inject(AuthService);
  private firebaseService: FirebaseService = inject(FirebaseService);

  fotos: Servicio[] = [];
  videos: Servicio[] = [];
  extras: Servicio[] = [];

  // Almacenará las claves (IDs) de los servicios que el usuario tiene en su carrito
  serviciosEnCarrito: Set<string> = new Set();
  totalCarrito: number = 0; // Para mostrar el total en el HTML (opcional en este componente)

  private subscriptions: Subscription = new Subscription(); // Para desuscribirse de todos los observables
  currentUserUid: string | null = null; // Para almacenar el UID del usuario actual

  ngOnInit() {
    // Escuchar el estado de autenticación del usuario
    this.subscriptions.add(
      this.authService.user$.subscribe(user => {
        this.currentUserUid = user ? user.uid : null;
        if (this.currentUserUid) {
          // Si hay usuario logueado, escuchar cambios en su carrito de Firebase
          this.subscriptions.add(
            this.firebaseService.obtenerCarritoUsuario(this.currentUserUid).subscribe(carrito => {
              this.serviciosEnCarrito = new Set(Object.keys(carrito || {}));
              this.calculateTotalCart(); // Recalcula el total del carrito
              // No es necesario llamar a updateServiceStates aquí, el HTML reacciona al Set
            })
          );
        } else {
          // Si no hay usuario, limpiar el carrito local y el total
          this.serviciosEnCarrito = new Set();
          this.calculateTotalCart(); // Recalcula el total del carrito (será 0)
        }
      })
    );

    this.fetchServices(); // Cargar los servicios disponibles
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe(); // Limpia todas las suscripciones al destruir el componente
  }

  private fetchServices() {
    const dbRef = ref(this.database);

    // Helper para cargar una categoría de servicios
    const loadCategory = (path: string, category: string): Observable<Servicio[]> => {
      return new Observable(observer => {
        onValue(child(dbRef, path), (snapshot) => {
          const services = this.snapshotToArray(snapshot, category);
          observer.next(services);
        }, (error) => {
          observer.error(error);
        });
      });
    };

    // Usar combineLatest para cargar todas las categorías y actualizar cuando cualquiera cambie
    this.subscriptions.add(
      combineLatest([
        loadCategory('servicios/fotos', 'fotos'),
        loadCategory('servicios/videos', 'videos'),
        loadCategory('servicios/extras', 'extras')
      ]).subscribe(([fotos, videos, extras]) => {
        this.fotos = fotos;
        this.videos = videos;
        this.extras = extras;
        console.log("Servicios cargados:", { fotos, videos, extras });
      })
    );
  }

  /**
   * Función auxiliar para convertir un DataSnapshot de Firebase a un array de Servicio.
   * Adapta los nombres de las propiedades según la categoría.
   */
  private snapshotToArray(snapshot: DataSnapshot, categoria: string): Servicio[] {
    const returnArr: Servicio[] = [];
    snapshot.forEach((childSnapshot) => {
      const item = childSnapshot.val();
      const id = childSnapshot.key;

      let nombreProp: string;
      let descripcionProp: string;
      let imagenProp: string;
      let precioProp: string;

      switch (categoria) {
        case 'fotos':
          nombreProp = 'nombre_f';
          descripcionProp = 'descripcion_f';
          imagenProp = 'imagen_f';
          precioProp = 'precio_f';
          break;
        case 'videos':
          nombreProp = 'nombre_v';
          descripcionProp = 'descripcion_v';
          imagenProp = 'imagen_v';
          precioProp = 'precio_v';
          break;
        case 'extras':
          nombreProp = 'nombre_e';
          descripcionProp = 'descripcion_e';
          imagenProp = 'imagen_e';
          precioProp = 'precio_e';
          break;
        default:
          console.warn(`Categoría desconocida: ${categoria}`);
          return;
      }

      const nombre = item[nombreProp] || '';
      const descripcion = item[descripcionProp] || '';
      const imagen = item[imagenProp] || '';
      const precio = parseFloat(item[precioProp]) || 0;

      const servicio: Servicio = {
        id: id || '',
        nombre: nombre,
        descripcion: descripcion,
        imagen: imagen,
        precio: precio
      };

      if (categoria === 'extras' && item.duracion_e) {
        servicio.duracion = item.duracion_e;
      }
      returnArr.push(servicio);
    });
    return returnArr;
  }

  // --- Lógica del Carrito con Botones ---
  // async toggleCart(service: Servicio): Promise<void> {
  //   if (!this.currentUserUid) {
  //     console.warn('Usuario no logueado. No se puede modificar el carrito en Firebase.');
  //     alert('Para añadir o quitar servicios, por favor, inicia sesión.');
  //     return;
  //   }

  //   if (this.serviciosEnCarrito.has(service.id)) {
  //     // Si el servicio ya está en el carrito, lo quitamos
  //     try {
  //       await this.firebaseService.quitarDelCarrito(this.currentUserUid, service.id);
  //       console.log(`Servicio ${service.nombre} quitado del carrito.`);
  //     } catch (error) {
  //       console.error('Error al quitar del carrito:', error);
  //       alert('Hubo un error al quitar el servicio del carrito.');
  //     }
  //   } else {
  //     // Si el servicio no está en el carrito, lo añadimos
  //     try {
  //       await this.firebaseService.agregarAlCarrito(this.currentUserUid, service.id, service.precio);
  //       console.log(`Servicio ${service.nombre} añadido al carrito.`);
  //     } catch (error) {
  //       console.error('Error al añadir al carrito:', error);
  //       alert('Hubo un error al añadir el servicio al carrito.');
  //     }
  //   }
  // }
  async toggleCart(service: Servicio): Promise<void> {
    if (!this.currentUserUid) {
      console.warn('Usuario no logueado. No se puede modificar el carrito en Firebase.');
      alert('Para añadir o quitar servicios, por favor, inicia sesión.');
      return;
    }

    if (this.serviciosEnCarrito.has(service.id)) {
      // ... quitar ...
    } else {
      // Si el servicio no está en el carrito, lo añadimos
      try {
        // Asegúrate de que service.id y service.precio son correctos aquí
        await this.firebaseService.agregarAlCarrito(this.currentUserUid, service.id, service.precio);
        console.log(`Servicio ${service.nombre} añadido al carrito.`);
      } catch (error) {
        console.error('Error al añadir al carrito:', error);
        alert('Hubo un error al añadir el servicio al carrito.');
      }
    }
  }

  // Método para verificar si un servicio está en el carrito (para el texto y estilo del botón)
  isInCart(serviceId: string): boolean {
    return this.serviciosEnCarrito.has(serviceId);
  }

  private calculateTotalCart(): void {
    let currentTotal = 0;
    // Debemos obtener los servicios reales para sumar sus precios
    // Combinar todos los servicios disponibles en una sola lista para un cálculo fácil
    const allServices = [...this.fotos, ...this.videos, ...this.extras];

    this.serviciosEnCarrito.forEach(serviceId => {
      const foundService = allServices.find(s => s.id === serviceId);
      if (foundService) {
        currentTotal += foundService.precio;
      }
    });
    this.totalCarrito = currentTotal;
    console.log('Total Carrito Actualizado:', this.totalCarrito);
  }

  // Métodos de navegación y pago (si los tienes, si no puedes eliminarlos)
  pagar(): void {
    console.log('Procediendo al pago...');
    // Aquí podrías navegar a un componente de carrito o pasarela de pago
    // Por ejemplo: this.router.navigate(['/checkout']);
  }

  logout(): void {
    this.authService.logoutUser();
    console.log('Usuario ha cerrado sesión.');
  }
}
