// src/app/carrito/carrito.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common'; // Importa CommonModule para pipes y directivas estructurales
import { FirebaseService, Servicio } from '../firebase/firefirebase-service.service'; // Ruta a tu FirebaseService
import { AuthService } from '../auth/auth.service'; // Ruta a tu AuthService
import { Subscription, combineLatest, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { RouterLink } from '@angular/router';

// Importamos User de @angular/fire/auth para tipar correctamente
import { User } from '@angular/fire/auth';

// Define la interfaz para tu servicio en el carrito
export interface CarritoItem extends Servicio {
  cantidad: number; // Siempre será 1 en este modelo simplificado de "está o no está"
  tipo: 'fotos' | 'videos' | 'extras'; // Usado para las clases CSS dinámicas
}

@Component({
  selector: 'app-carrito',
  templateUrl: './carrito.component.html',
  styleUrls: ['./carrito.component.css'],
  standalone: true, // ¡IMPORTANTE! Marca el componente como standalone
  imports: [CommonModule, RouterLink] // Importa CommonModule aquí para usar pipes como 'number' y directivas / tambien las Rutas
})
export class CarritoComponent implements OnInit, OnDestroy {
  cartItems: CarritoItem[] = [];
  totalCarrito: number = 0;
  currentUserUid: string | null = null;
  private subscriptions: Subscription = new Subscription();

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.user$.pipe(
        map((user: User | null) => user ? user.uid : null),
        switchMap(uid => {
          this.currentUserUid = uid;
          if (uid) {
            // Combina los observables para obtener el carrito del usuario y todos los servicios
            return combineLatest([
              this.firebaseService.obtenerCarritoUsuario(uid),
              this.firebaseService.getServicios()
            ]).pipe(
              map(([cartData, allServices]) => {
                const items: CarritoItem[] = [];
                let total = 0;

                if (cartData) {
                  // Itera sobre los IDs de servicio en el carrito del usuario
                  for (const serviceId in cartData) {
                    // La cantidad en el carrito es 1 si el servicio está presente
                    // const cantidad = cartData[serviceId]; // Ya no se usa directamente, siempre asumimos 1
                    const service = allServices?.find((s: Servicio) => s.id === serviceId);

                    if (service) {
                      // Mapea la categoría de Firebase a un 'tipo' para las clases CSS
                      let tipo: 'fotos' | 'videos' | 'extras';
                      if (service.categoria === 'foto') {
                        tipo = 'fotos';
                      } else if (service.categoria === 'video') {
                        tipo = 'videos';
                      } else {
                        tipo = 'extras';
                      }

                      items.push({
                        ...service, // Copia todas las propiedades del servicio (id, nombre, descripcion, precio, imagen, duracion, categoria)
                        cantidad: 1, // La cantidad siempre es 1 para este modelo
                        tipo: tipo // Asigna el tipo para las clases CSS
                      });
                      total += service.precio; // Suma el precio del servicio una sola vez al total
                    }
                  }
                }
                return { items, total };
              })
            );
          } else {
            // Si no hay usuario logueado, el carrito está vacío
            return of({ items: [], total: 0 });
          }
        })
      ).subscribe(({ items, total }) => {
        this.cartItems = items;
        this.totalCarrito = total;
      }, (error: any) => {
        console.error("Error al cargar el carrito:", error);
      })
    );
  }

  // Los métodos increaseQuantity y decreaseQuantity han sido eliminados,
  // ya que no se manejan cantidades por servicio.

  async removeFromCart(serviceId: string): Promise<void> {
    if (this.currentUserUid) {
      try {
        await this.firebaseService.quitarDelCarrito(this.currentUserUid, serviceId);
      } catch (error: any) {
        console.error("Error al quitar del carrito en Realtime DB:", error);
      }
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
