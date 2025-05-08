import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, DataSnapshot, Database } from 'firebase/database';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Servicio } from './../models/servicio.model';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private database: Database;

  constructor() {
    const app = initializeApp(environment.firebaseConfig);
    this.database = getDatabase(app);
  }

  getServicios(): Observable<Servicio[]> {
    const serviciosRef = ref(this.database, 'servicios');
    return new Observable((observer) => {
      onValue(serviciosRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const serviciosArray: Servicio[] = Object.keys(data).map(key => ({
            key: key,
            ...data[key] as Servicio
          }));
          observer.next(serviciosArray);
        } else {
          observer.next([]);
        }
        observer.complete();
      }, (error) => {
        observer.error(error);
      });
    });
  }

  guardarCarritoUsuario(uid: string, carrito: { servicios: Servicio[] }): Promise<void> {
    const carritoRef = ref(this.database, `users/${uid}/carrito`);
    return set(carritoRef, carrito);
  }

  obtenerCarritoUsuario(uid: string): Observable<{ servicios: Servicio[] } | null> {
    const carritoRef = ref(this.database, `users/${uid}/carrito`);
    return new Observable((observer) => {
      onValue(carritoRef, (snapshot) => {
        observer.next(snapshot.val() as { servicios: Servicio[] } | null);
        observer.complete();
      }, (error) => {
        observer.error(error);
      });
    });
  }
}
