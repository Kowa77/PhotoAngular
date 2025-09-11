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
  currentImageIndex: number = 0; // índice de la foto seleccionada

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
    const backendUrl = `/api/gallery/${userId}`; // resolución optimizada para web 1920x1080
    this.http.get<any[]>(backendUrl).subscribe({
      next: (data) => {
        this.photos = data;
        //this.photoUrls = this.photos.map(p => p.baseUrl);
        this.photoUrls = this.photos.map(p => `${p.baseUrl}=w2048-h1152`); // resolución optimizada para web 2048x1152
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

  // Eliminar la foto actualmente seleccionada (deshabilitado temporalmente)
  // deletePhoto(): void {
  //   if (this.photos.length === 0 || this.currentImageIndex < 0 || !this.userId) {
  //     console.warn('⚠️ No hay foto seleccionada para eliminar o el ID de usuario no está disponible.');
  //     return;
  //   }

  //   const photoToDelete = this.photos[this.currentImageIndex];
  //   const photoId = photoToDelete.id;

  //   if (!confirm(`¿Estás seguro de que deseas eliminar la foto: ${photoToDelete.filename}?`)) {
  //     return; // El usuario canceló
  //   }

  //   const backendUrl = `/api/delete-photo/${photoId}`;

  //   this.http.post(backendUrl, { userId: this.userId }).subscribe({
  //     next: () => {
  //       console.log(`✅ Foto con ID ${photoId} eliminada correctamente.`);
  //       // Recargar galería
  //       if (this.userId) {
  //         this.loadGallery(this.userId);
  //       }
  //     },
  //     error: (err) => {
  //       console.error('❌ Error al eliminar la foto:', err);
  //       alert('Hubo un error al eliminar la foto. Por favor, inténtalo de nuevo.');
  //     }
  //   });
  // }

  // Cambiar imagen principal
  selectImage(index: number): void {
    this.currentImageIndex = index;
  }

  // Sincronizar índice con el carrusel
  onImageChanged(index: number): void {
    this.currentImageIndex = index;
  }

  // Descargar la foto actualmente seleccionada en máxima calidad
  downloadPhoto(): void {
    if (this.photos.length === 0 || this.currentImageIndex < 0) {
      console.warn('⚠️ No hay foto seleccionada para descargar.');
      return;
    }

    const photo = this.photos[this.currentImageIndex];
    const downloadUrl = `${photo.baseUrl}=d`; // ✅ Alta calidad Google Photos

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = photo.filename || 'foto.jpg'; // nombre sugerido
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
