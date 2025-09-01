// src/app/paginas/gallery/gallery.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// Es una buena práctica definir una interfaz para el modelo de datos.
interface Photo {
  _id: string;
  url: string;
  title: string;
  description?: string;
  userId: string;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.css'],
})
export class GalleryComponent implements OnInit, OnDestroy {
  photos: Photo[] = [];
  userId: string | null = null;
  isLoading: boolean = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.userId = params.get('userId');
      if (this.userId) {
        this.loadGallery(this.userId);
      } else {
        this.error = 'No se encontró el ID de usuario en la URL.';
        console.error(this.error);
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadGallery(userId: string): void {
    this.isLoading = true;
    this.error = null;
    // Es mejor usar variables de entorno para la URL del backend.
    const backendUrl = `${environment.apiUrl}/gallery/${userId}`;
    this.http.get<Photo[]>(backendUrl).subscribe({
      next: (data) => {
        this.photos = data;
        console.log('Fotos cargadas con éxito:', this.photos);
        this.isLoading = false;
      },
      error: (error) => {
        this.error = 'Hubo un error al cargar la galería. Por favor, inténtelo de nuevo más tarde.';
        console.error('Error al cargar la galería:', error);
        this.isLoading = false;
      },
    });
  }
}
