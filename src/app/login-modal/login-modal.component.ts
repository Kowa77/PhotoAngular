import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-modal.component.html',
  styleUrl: './login-modal.component.css'
})
export class LoginModalComponent {
  isVisible: boolean = false;
  credentials = { email: '', password: '' };
  resetEmail: string = '';
  errorMessage: string = '';
  successMessage: string = '';
  showResetForm: boolean = false;
  @Output() loginSuccess = new EventEmitter<any>();
  @Output() closeModalEvent = new EventEmitter<void>();
  @Output() openRegisterModalEvent = new EventEmitter<void>(); // Nuevo evento

  constructor(private authService: AuthService) { }

  openModal() {
    this.isVisible = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.showResetForm = false;
  }

  closeModal() {
    this.isVisible = false;
    this.closeModalEvent.emit();
  }

  emitOpenRegisterModal() {
    this.closeModal(); // Cierra el modal de login
    this.openRegisterModalEvent.emit(); // Emite el evento para abrir el modal de registro
  }

  async login() {
    try {
      const user = await this.authService.loginUser(this.credentials.email, this.credentials.password);
      this.loginSuccess.emit(user);
      this.closeModal();
    } catch (error: any) {
      this.errorMessage = this.authService.getErrorMessage(error.code);
    }
  }

  showResetPasswordForm() {
    this.showResetForm = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  hideResetPasswordForm() {
    this.showResetForm = false;
    this.errorMessage = '';
    this.successMessage = '';
  }

  async resetPassword() {
    if (!this.resetEmail) {
      this.errorMessage = 'Por favor, ingresa tu correo electrónico.';
      return;
    }

    try {
      await this.authService.resetPassword(this.resetEmail);
      this.successMessage = 'Se ha enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.';
      this.errorMessage = '';
      // Limpiar el email después de enviar
      this.resetEmail = '';
    } catch (error: any) {
      this.errorMessage = this.authService.getErrorMessage(error.code);
      this.successMessage = '';
    }
  }
}
