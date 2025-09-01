// src/app/paginas/gallery/gallery.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

import { GalleryModule } from 'ng-gallery';
import { GalleryItem, ImageItem } from 'ng-gallery';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, GalleryModule],
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.css']
})
export class GalleryComponent implements OnInit {
  photos: GalleryItem[] = [];
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
    const backendUrl = `http://localhost:3000/api/gallery/${userId}`;
    this.http.get<any[]>(backendUrl).subscribe({
      next: (data: any[]) => {
        this.photos = data.map((photo) => {
          return new ImageItem({ src: photo.baseUrl, thumb: photo.baseUrl });
        });

        console.log('Fotos cargadas con éxito:', this.photos);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar la galería:', error);
        this.isLoading = false;
      }
    });
  }

  /**
   * Método para descargar la imagen seleccionada.
   * Agrega el parámetro '=d' a la URL para forzar la descarga.
   */
  downloadImage(imageUrl: string): void {
    if (imageUrl) {
      const downloadUrl = imageUrl + '=d';
      window.open(downloadUrl, '_blank');
    }
  }

}
