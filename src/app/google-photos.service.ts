import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GooglePhotosService {
  private backendUrl = 'http://localhost:3000/api';

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
