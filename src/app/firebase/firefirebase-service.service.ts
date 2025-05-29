// src/app/firebase/firefirebase-service.service.ts
import { Injectable, inject } from '@angular/core';
import { Database, ref, set, get, remove, onValue, push, child } from '@angular/fire/database';
import { Observable, combineLatest, map, tap, from } from 'rxjs';
import { Auth, user, User as FirebaseAuthUser } from '@angular/fire/auth';

// Define la interfaz de tu servicio. Asegúrate de que coincida con tus datos de Realtime DB.
export interface Servicio {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string;
  duracion?: string; // Para extras, opcional
  categoria: 'foto' | 'video' | 'extra'; // La categoría mapeada por tu getCategory
}


@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private database: Database = inject(Database);
  private auth: Auth = inject(Auth);

  constructor() {
    console.log("FirebaseService: Firebase Database (modular) injected.");
  }

  private getCategory<T>(path: string): Observable<T[]> {
    const categoryRef = ref(this.database, path);
    console.log(`FirebaseService: Obteniendo colección de Realtime DB: ${path}`);

    return new Observable(observer => {
      const unsubscribe = onValue(categoryRef, (snapshot) => {
        const data = snapshot.val();
        const items: T[] = [];
        if (data) {
          for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
              const rawItem = data[key];
              let mappedItem: any = { id: key }; // Empieza con el ID del nodo

              const category = path.split('/').pop();

              if (category === 'fotos') {
                mappedItem.nombre = rawItem.nombre_f;
                mappedItem.descripcion = rawItem.descripcion_f;
                mappedItem.precio = rawItem.precio_f;
                mappedItem.imagen = rawItem.imagen_f;
                mappedItem.categoria = 'foto'; // Asignar la categoría correcta como 'foto'
              } else if (category === 'videos') {
                mappedItem.nombre = rawItem.nombre_v;
                mappedItem.descripcion = rawItem.descripcion_v;
                mappedItem.precio = rawItem.precio_v;
                mappedItem.imagen = rawItem.imagen_v;
                mappedItem.categoria = 'video'; // Asignar la categoría correcta como 'video'
                mappedItem.duracion = rawItem.duracion_v; // Si los videos tienen duracion_v
              } else if (category === 'extras') {
                mappedItem.nombre = rawItem.nombre_e;
                mappedItem.descripcion = rawItem.descripcion_e;
                mappedItem.precio = rawItem.precio_e;
                mappedItem.imagen = rawItem.imagen_e;
                mappedItem.categoria = 'extra'; // Asignar la categoría correcta como 'extra'
                mappedItem.duracion = rawItem.duracion_e; // Si los extras tienen duracion_e
              }

              items.push(mappedItem as T);
            }
          }
        }
        console.log(`FirebaseService: Datos de ${path} cargados con IDs de nodo y mapeados:`, items);
        observer.next(items);
      }, (error) => {
        console.error(`FirebaseService: Error al obtener categoría ${path} de Realtime DB:`, error);
        observer.error(error);
      });

      return { unsubscribe };
    });
  }

  getFotos(): Observable<Servicio[]> {
    return this.getCategory<Servicio>('servicios/fotos').pipe(
      tap(data => console.log('FirebaseService: Servicios de fotos cargados (modular):', data))
    );
  }

  getVideos(): Observable<Servicio[]> {
    return this.getCategory<Servicio>('servicios/videos').pipe(
      tap(data => console.log('FirebaseService: Servicios de videos cargados (modular):', data))
    );
  }

  getExtras(): Observable<Servicio[]> {
    return this.getCategory<Servicio>('servicios/extras').pipe(
      tap(data => console.log('FirebaseService: Servicios de extras cargados (modular):', data))
    );
  }

  getServicios(): Observable<Servicio[]> {
    console.log("FirebaseService: getServicios - Combinando todos los servicios de Realtime Database.");
    return combineLatest([
      this.getFotos(),
      this.getVideos(),
      this.getExtras()
    ]).pipe(
      map(([fotos, videos, extras]) => {
        const allServicios = [...fotos, ...videos, ...extras];
        console.log("FirebaseService: getServicios - Total de servicios combinados desde Realtime Database:", allServicios.length);
        return allServicios;
      })
    );
  }

  // --- Métodos para el carrito de usuario en Realtime Database ---

  obtenerCarritoUsuario(userId: string): Observable<{ [serviceId: string]: number }> {
    const carritoRef = ref(this.database, `carritos/${userId}`);
    console.log(`FirebaseService: Suscribiéndose a carrito de Realtime DB para UID: ${userId}`);

    return new Observable(observer => {
      const unsubscribe = onValue(carritoRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          console.log(`FirebaseService: Carrito recibido de Realtime DB para ${userId}:`, data);
          observer.next(data as { [serviceId: string]: number });
        } else {
          console.log(`FirebaseService: Carrito vacío o no existe en Realtime DB para ${userId}.`);
          observer.next({});
        }
      }, (error) => {
        console.error(`FirebaseService: Error al obtener carrito de Realtime DB para ${userId}:`, error);
        observer.error(error);
      });

      return { unsubscribe };
    });
  }

  // Este método guarda/actualiza el carrito completo (útil si manejas cantidades)
  // En el modelo simplificado de "está/no está", addToCart y quitarDelCarrito son más directos.
  async guardarCarritoUsuario(userId: string, carrito: { [serviceId: string]: number }): Promise<void> {
    const carritoRef = ref(this.database, `carritos/${userId}`);
    console.log(`FirebaseService: Guardando/actualizando carrito completo en Realtime DB para ${userId}:`, carrito);
    await set(carritoRef, carrito);
    console.log(`FirebaseService: Carrito completo guardado exitosamente en Realtime DB para ${userId}.`);
  }

  // Este método añade un servicio al carrito con cantidad 1
  async addToCart(userId: string, item: Servicio): Promise<void> {
    const itemRef = ref(this.database, `carritos/${userId}/${item.id}`);
    console.log(`FirebaseService: Añadiendo/actualizando ${item.nombre} (ID: ${item.id}) en carrito de Realtime DB para ${userId}.`);
    // Establece la cantidad a 1. Si ya existe, la sobrescribe a 1.
    await set(itemRef, 1);
    console.log(`FirebaseService: Servicio ${item.id} añadido/actualizado en Realtime DB para ${userId}.`);
  }

  async quitarDelCarrito(userId: string, serviceIdToRemove: string): Promise<void> {
    const itemRef = ref(this.database, `carritos/${userId}/${serviceIdToRemove}`);
    console.log(`FirebaseService: Intentando remover ${serviceIdToRemove} de carrito de Realtime DB para ${userId}.`);
    await remove(itemRef);
    console.log(`FirebaseService: Servicio ${serviceIdToRemove} quitado de Realtime DB para ${userId}.`);
  }
}
