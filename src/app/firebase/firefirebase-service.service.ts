import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, push, set } from 'firebase/database';
import { Servicio } from './../models/servicio.model';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private database: any;

  constructor(private db: AngularFireDatabase) {
    const app = initializeApp(environment.firebase);
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
            ...data[key]
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
    return this.db.object<{ servicios: Servicio[] }>(`users/${uid}/carrito`).valueChanges();
  }
}
