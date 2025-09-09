import {
  Component,
  OnInit,
  signal,
  OnDestroy,
  inject,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../auth/auth.service';
import { AdminStatsComponent } from '../admin-stats/admin-stats.component';
import { UserCountComponent } from '../user-count/user-count.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-upload-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    AdminStatsComponent,
    UserCountComponent
  ],
  templateUrl: './upload-form.component.html',
  styleUrl: './upload-form.component.css'
})
export class UploadFormComponent implements OnInit, OnDestroy {
  selectedFiles = signal<File[]>([]);
  targetUserEmail = signal<string>('');
  uploadStatus = signal<string>('');
  isUploading = signal<boolean>(false);
  isUserAuthenticated = signal<boolean>(false);

  @ViewChild(AdminStatsComponent) statsComponent:
    | AdminStatsComponent
    | undefined;

  private authService: AuthService = inject(AuthService);
  private http: HttpClient = inject(HttpClient);
  private destroy$ = new Subject<void>();

  private currentUserUid: string | null = null;

  ngOnInit(): void {
    this.authService
      .getCurrentUserUid()
      .pipe(takeUntil(this.destroy$))
      .subscribe((uid) => {
        this.currentUserUid = uid;
        this.isUserAuthenticated.set(!!uid);
        console.log('User UID:', uid);
      });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFiles.set(Array.from(input.files));
    } else {
      this.selectedFiles.set([]);
    }
  }

  onUpload() {
    if (
      !this.selectedFiles() ||
      this.selectedFiles().length === 0 ||
      !this.isValidEmail(this.targetUserEmail())
    ) {
      this.uploadStatus.set(
        'Por favor, selecciona archivos y escribe un correo válido.'
      );
      return;
    }

    this.isUploading.set(true);
    this.uploadStatus.set('Subiendo...');

    const formData = new FormData();
    this.selectedFiles().forEach((file) => {
      formData.append('photos', file, file.name);
    });
    formData.append('targetUserEmail', this.targetUserEmail());

    // Debug
    for (const [key, value] of formData.entries()) {
      console.log('➡️ FormData:', key, value);
    }

    this.http
      .post(`${environment.apiUrl}/upload-photos`, formData, {
        withCredentials: true,
      })
      .subscribe({
        next: (res: any) => {
          console.log('✅ Respuesta del backend:', res);
          this.uploadStatus.set('¡Fotos subidas con éxito!');
          this.isUploading.set(false);

          this.selectedFiles.set([]);
          this.targetUserEmail.set('');
          const fileInput = document.getElementById(
            'fileInput'
          ) as HTMLInputElement;
          if (fileInput) fileInput.value = '';

          if (this.statsComponent) {
            this.statsComponent.refreshStats();
          }
        },
        error: (err: any) => {
          console.error('❌ Error al subir fotos:', err);
          this.uploadStatus.set(
            'Error: ' +
              (err.error?.error || 'No se pudieron subir las fotos.')
          );
          this.isUploading.set(false);
        }
      });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
