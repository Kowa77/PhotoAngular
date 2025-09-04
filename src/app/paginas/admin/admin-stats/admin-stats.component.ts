import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './admin-stats.component.html',
  styleUrl: './admin-stats.component.css'
})
export class AdminStatsComponent implements OnInit {
  totalPhotos = signal<number | null>(null);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  private http = inject(HttpClient);

  ngOnInit(): void {
    this.fetchStats();
  }

  // Nuevo: Método para refrescar las estadísticas.
  // Lo haremos público para que pueda ser llamado desde el HTML del padre.
  refreshStats(): void {
    this.fetchStats();
  }

  // El método original para la llamada a la API
  fetchStats(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.totalPhotos.set(null);

    const apiUrl = `${environment.apiUrl}/admin/photo-stats`;

    this.http.get<{ totalPhotos: number }>(apiUrl).subscribe({
      next: (data) => {
        this.totalPhotos.set(data.totalPhotos);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching photo stats:', err);
        this.errorMessage.set('Error al cargar las estadísticas. Asegúrate de que el servidor backend esté funcionando.');
        this.isLoading.set(false);
      }
    });
  }
}
