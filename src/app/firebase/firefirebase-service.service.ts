import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
import { Servicio } from './../models/servicio.model'; // Importa la interfaz

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {

  private database: any;

  constructor() {
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
}

// import { Injectable } from '@angular/core';
// import { AngularFireDatabase } from '@angular/fire/compat/database';
// import { Observable } from 'rxjs';
// import { map } from 'rxjs/operators';
// import { environment } from '../../environments/environment';
// import { initializeApp } from 'firebase/app';
// import { getDatabase, ref, onValue } from 'firebase/database';

// @Injectable({
//   providedIn: 'root'
// })
// export class FirebaseService {

//   private database: any;

//   constructor() {
//     const app = initializeApp(environment.firebase);
//     this.database = getDatabase(app);
//   }

//   getServicios(): Observable<string[]> {
//     const serviciosRef = ref(this.database, 'servicios');
//     return new Observable((observer) => {
//       onValue(serviciosRef, (snapshot) => {
//         const data = snapshot.val();
//         if (data) {
//           const serviciosArray = Object.keys(data);
//           observer.next(serviciosArray);
//         } else {
//           observer.next([]);
//         }
//         observer.complete();
//       }, (error) => {
//         observer.error(error);
//       });
//     });
//   }
// }
