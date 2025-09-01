// src/app/paginas/gallery/gallery.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.css']
})
export class GalleryComponent implements OnInit {
  photos: any[] = [];
  userId: string | null = '';
  isLoading: boolean = true;

  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.userId = params.get('userId');
      if (this.userId) {
        this.loadGallery(this.userId);
      } else {
        console.error('No se encontró el userId en la URL.');
        this.isLoading = false;
      }
    });
  }

  loadGallery(userId: string): void {
    this.isLoading = true;
    // Usa la ruta y el método correctos para el backend
    const backendUrl = `http://localhost:3000/api/gallery/${userId}`;
    this.http.get<any[]>(backendUrl).subscribe({ // <-- Cuidado: Cambiado de .post a .get
      next: (data) => {
        // En el backend simplificamos el objeto de respuesta, ahora `data` es directamente el array
        this.photos = data;
        console.log('Fotos cargadas con éxito:', this.photos);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar la galería:', error);
        this.isLoading = false;
      }
    });
  }
}
