import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GooglePhotosService {
  private backendUrl = environment.apiUrl; // Asegúrate de definir esta variable en tu entorno

  constructor(private http: HttpClient) { }

  createUserAlbum(userId: string, userName: string): Observable<any> {
    return this.http.post(`${this.backendUrl}/create-user-album`, { userId, userName });
  }

  uploadPhoto(albumId: string, photoName: string, photoData: ArrayBuffer): Observable<any> {
    return this.http.post(`${this.backendUrl}/upload-photo`, photoData, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Goog-Upload-File-Name': photoName,
      },
      params: { albumId }
    });
  }

  getGallery(userId: string): Observable<any> {
    return this.http.get(`${this.backendUrl}/gallery/${userId}`);
  }
}
