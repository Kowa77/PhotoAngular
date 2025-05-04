import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service'; // Importa el AuthService

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-modal.component.html',
  styleUrl: './login-modal.component.css'
})
export class LoginModalComponent {
  isVisible: boolean = false;
  credentials = { email: '', password: '' }; // Usa 'email' en lugar de 'username'
  errorMessage: string = '';
  @Output() loginSuccess = new EventEmitter<any>();
  @Output() closeModalEvent = new EventEmitter<void>();

  constructor(private authService: AuthService) { } // Inyecta el AuthService

  openModal() {
    this.isVisible = true;
    this.errorMessage = '';
  }

  closeModal() {
    this.isVisible = false;
    this.closeModalEvent.emit();
  }

  async login() {
    try {
      const user = await this.authService.loginUser(this.credentials.email, this.credentials.password);
      //console.log('Inicio de sesión exitoso:', user);
      this.loginSuccess.emit(user);
      this.closeModal();
    } catch (error: any) {
      //console.error('Error al iniciar sesión:', error);
      this.errorMessage = this.authService.getErrorMessage(error.code); // Usa el método del servicio
    }
  }
}
