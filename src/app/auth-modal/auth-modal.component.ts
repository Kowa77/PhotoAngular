import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { CommonModule } from '@angular/common';
import * as bootstrap from 'bootstrap';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './auth-modal.component.html',
  styleUrls: ['./auth-modal.component.css']
})
export class AuthModalComponent implements AfterViewInit, OnDestroy {
  loginEmail = '';
  loginPassword = '';
  registerEmail = '';
  registerPassword = '';
  confirmPassword = '';
  loginError: string | null = null;
  registerError: string | null = null;
  showLogin = true;
  passwordVisible = false;

  @ViewChild('authModalElement') authModalElement!: ElementRef;
  private modalInstance: bootstrap.Modal | null = null;

  constructor(private authService: AuthService, private cdr: ChangeDetectorRef) { }

  ngAfterViewInit(): void {
    this.modalInstance = new bootstrap.Modal(this.authModalElement.nativeElement);
  }

  ngOnDestroy(): void {
    if (this.modalInstance) {
      this.modalInstance.dispose();
      this.modalInstance = null;
    }
  }

  async login() {
    this.loginError = null;
    try {
      await this.authService.loginUser(this.loginEmail, this.loginPassword);
      console.log('Inicio de sesión exitoso');
      this.cdr.detectChanges(); // Forzar detección de cambios ANTES de cerrar
      this.closeModal();
    } catch (error: any) {
      this.loginError = this.authService.getErrorMessage(error.code);
    }
  }

  async register() {
    this.registerError = null;
    if (this.registerPassword !== this.confirmPassword) {
      this.registerError = 'Las contraseñas no coinciden.';
      return;
    }
    try {
      await this.authService.registerUser(this.registerEmail, this.registerPassword);
      console.log('Registro exitoso');
      // En lugar de cambiar a la pestaña de login, cerramos el modal directamente
      this.closeModal();
      // Opcionalmente, podrías emitir un evento para notificar a otros componentes
      // que el registro fue exitoso y realizar alguna otra acción (ej: mostrar un mensaje)
    } catch (error: any) {
      this.registerError = this.authService.getErrorMessage(error.code);
    }
  }

  toggleForm() {
    this.showLogin = !this.showLogin;
    this.loginError = null;
    this.registerError = null;
  }

  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  closeModal() {
    if (this.modalInstance) {
      this.modalInstance.hide();
      this.cdr.detectChanges();
      const backdrops = document.querySelectorAll('.modal-backdrop');
      backdrops.forEach(backdrop => backdrop.remove());
    }
  }

  openModal() {
    if (!this.modalInstance) {
      this.modalInstance = new bootstrap.Modal(this.authModalElement.nativeElement);
    }
    // Asegúrate de que la instancia exista antes de mostrar
    if (this.modalInstance) {
      this.modalInstance.show();
    }
  }

}
