import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { ImageCarouselComponent } from '../../components/image-carousel/image-carousel.component';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, ImageCarouselComponent],
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.css']
})
export class GalleryComponent implements OnInit {
  photos: any[] = [];
  photoUrls: string[] = [];
  userId: string | null = '';
  isLoading: boolean = true;
  currentImageIndex: number = 0; // Nuevo: Para el índice de la foto seleccionada

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
      next: (data) => {
        this.photos = data;
        this.photoUrls = this.photos.map(p => p.baseUrl);
        this.isLoading = false;
        console.log('✅ Fotos cargadas con éxito:', this.photos);
      },
      error: (err) => {
        console.error('❌ Error al cargar la galería:', err);
        this.isLoading = false;
        this.photos = [];
        this.photoUrls = [];
      }
    });
  }

  // Función para establecer la imagen principal al hacer clic en una miniatura
  selectImage(index: number): void {
    this.currentImageIndex = index;
  }

  // Función para sincronizar el índice cuando el carrusel cambia de imagen
  onImageChanged(index: number): void {
    this.currentImageIndex = index;
  }
}
