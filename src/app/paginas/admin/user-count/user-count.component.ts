import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-user-count',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-count.component.html',
  styleUrl: './user-count.component.css'
})
export class UserCountComponent implements OnInit {
  totalUsers = signal<number | null>(null);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  private http = inject(HttpClient);

  ngOnInit(): void {
    this.fetchUserCount();
  }

  fetchUserCount(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.totalUsers.set(null);

    const apiUrl = `${environment.apiUrl}/admin/user-count`;

    this.http.get<{ totalUsers: number }>(apiUrl).subscribe({
      next: (data) => {
        this.totalUsers.set(data.totalUsers);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching user count:', err);
        this.errorMessage.set('Error al cargar el conteo de usuarios.');
        this.isLoading.set(false);
      }
    });
  }
}
