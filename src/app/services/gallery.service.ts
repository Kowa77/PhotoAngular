// src/app/services/gallery.service.ts
import { Injectable, inject } from '@angular/core';
import { Database, ref, query, onValue, orderByChild, equalTo } from '@angular/fire/database';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface Photo {
  id: string;
  baseUrl: string;
  title: string;
  description?: string;
  userId: string;
}

@Injectable({
  providedIn: 'root'
})
export class GalleryService {
  // Inyecta directamente la base de datos aquí
  private db: Database = inject(Database);

  getPhotosByUserId(userId: string): Observable<Photo[]> {
    const photosRef = ref(this.db, 'photos');
    const userPhotosQuery = query(photosRef, orderByChild('userId'), equalTo(userId));

    // El observable es ahora el que usa la función onValue
    return new Observable(observer => {
      const unsubscribe = onValue(userPhotosQuery, (snapshot) => {
        const photos: Photo[] = [];
        snapshot.forEach((childSnapshot) => {
          photos.push({
            id: childSnapshot.key as string,
            ...childSnapshot.val()
          });
        });
        observer.next(photos);
      }, (error) => {
        observer.error(error);
      });

      return { unsubscribe };
    }).pipe(
      map(photos => photos as Photo[])
    );
  }
}
