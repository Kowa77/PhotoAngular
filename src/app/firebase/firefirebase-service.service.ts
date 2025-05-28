// src/app/firebase/firefirebase-service.service.ts
import { Injectable, inject } from '@angular/core';
import { Database, ref, set, remove, get, child, onValue } from '@angular/fire/database';
import { Observable, forkJoin } from 'rxjs'; // Importa forkJoin
import { map } from 'rxjs/operators';
import { Servicio } from '../models/servicio.model'; // Importa la interfaz Servicio

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private database: Database = inject(Database); // Esta es la forma correcta.

  constructor() {
    // Si el error persiste, podrías intentar inyectar aquí también para ver si cambia algo
    // Pero 'inject' en la propiedad es el camino recomendado en Angular 14+
    // console.log('FirebaseService: Database injected:', this.database);
  }

  /**
   * Obtiene todos los servicios (fotos, videos, extras) y los adapta a la interfaz Servicio genérica.
   */
  getServicios(): Observable<Servicio[]> {
    const dbRef = ref(this.database);

    const getCategoryServices = (categoryPath: string, categoryName: string): Observable<Servicio[]> => {
      return new Observable(observer => {
        onValue(child(dbRef, categoryPath), (snapshot) => {
          const services: Servicio[] = [];
          if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
              const item = childSnapshot.val();
              const id = childSnapshot.key;

              let nombreProp: string;
              let descripcionProp: string;
              let imagenProp: string;
              let precioProp: string;

              switch (categoryName) {
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
                  console.warn(`Categoría desconocida: ${categoryName}`);
                  return; // Salir si la categoría no es válida
              }

              const servicio: Servicio = {
                id: id || '',
                nombre: item[nombreProp] || '',
                descripcion: item[descripcionProp] || '',
                imagen: item[imagenProp] || '',
                precio: parseFloat(item[precioProp]) || 0
              };

              if (categoryName === 'extras' && item.duracion_e) {
                servicio.duracion = item.duracion_e;
              }
              services.push(servicio);
            });
          }
          observer.next(services);
        }, (error) => {
          observer.error(error);
        });
      });
    };

    // Combina los observables de cada categoría
    return forkJoin([
      getCategoryServices('servicios/fotos', 'fotos'),
      getCategoryServices('servicios/videos', 'videos'),
      getCategoryServices('servicios/extras', 'extras')
    ]).pipe(
      map(([fotos, videos, extras]) => [...fotos, ...videos, ...extras]) // Combina todos los arrays en uno
    );
  }

  /**
   * Añade un servicio al carrito de un usuario.
   * @param uid ID del usuario.
   * @param serviceId ID del servicio a añadir.
   * @param price Precio del servicio.
   */
  async agregarAlCarrito(uid: string, serviceId: string, price: number): Promise<void> {
    const carritoRef = ref(this.database, `carritos/${uid}/${serviceId}`);
    return set(carritoRef, price);
  }

  /**
   * Quita un servicio del carrito de un usuario.
   * @param uid ID del usuario.
   * @param serviceId ID del servicio a quitar.
   */
  async quitarDelCarrito(uid: string, serviceId: string): Promise<void> {
    const carritoRef = ref(this.database, `carritos/${uid}/${serviceId}`);
    return remove(carritoRef);
  }

  /**
   * Obtiene el contenido del carrito de un usuario como un Observable.
   * @param uid ID del usuario.
   * @returns Observable que emite un objeto donde las claves son serviceId y los valores son los precios.
   */
  // obtenerCarritoUsuario(uid: string): Observable<{ [key: string]: number }> {
  //   const carritoRef = ref(this.database, `carritos/${uid}`);
  //   return new Observable(observer => {
  //     const unsubscribe = onValue(carritoRef, (snapshot) => {
  //       const carrito = snapshot.val() || {};
  //       observer.next(carrito);
  //     }, (error) => {
  //       observer.error(error);
  //     });
  //     return { unsubscribe: unsubscribe };
  //   });
  // }
  obtenerCarritoUsuario(uid: string): Observable<{ [key: string]: number }> {
    const carritoRef = ref(this.database, `carritos/${uid}`);
    return new Observable(observer => {
      const unsubscribe = onValue(carritoRef, (snapshot) => {
        const carrito = snapshot.val() || {};
        console.log(`FirebaseService: Carrito para UID ${uid} recibido desde Firebase:`, carrito); // LOG
        observer.next(carrito);
      }, (error) => {
        console.error(`FirebaseService: Error al obtener carrito para UID ${uid}:`, error); // LOG
        observer.error(error);
      });
      // Importante: devolver una función de limpieza para desuscribirse cuando el Observable se desuscribe
      return { unsubscribe: unsubscribe };
    });
  }

  /**
   * Guarda o actualiza completamente el carrito de un usuario.
   * @param uid ID del usuario.
   * @param carrito Objeto representando el carrito (serviceId: precio).
   */
  async guardarCarritoUsuario(uid: string, carrito: { [key: string]: number }): Promise<void> {
    const userCartRef = ref(this.database, `carritos/${uid}`);
    return set(userCartRef, carrito);
  }
}
