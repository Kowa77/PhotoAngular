import { Component, OnInit, OnDestroy } from '@angular/core'; // Añadir OnInit y OnDestroy
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EmailService } from '../../email.service'; // Importa el servicio de correo
import { AuthService } from '../../auth/auth.service'; // Importa tu AuthService
import { Subscription } from 'rxjs'; // Para manejar la suscripción

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './contacto.component.html',
  styleUrl: './contacto.component.css'
})
export class ContactoComponent implements OnInit, OnDestroy { // Implementa OnInit y OnDestroy

  title = 'email-app-angular';

  // Objeto para almacenar los datos del formulario
  emailData = {
    from: '', // <--- ¡Añadido! Este campo se llenará con el email del usuario logueado
    to: 'bsfotografiayvideo@gmail.com', // Destinatario del correo
    subject: '', // Asunto del correo
    text: '',    // Contenido del correo en texto plano
    // html: ''   // Contenido del correo en HTML (opcional)
  };

  // Variables para mostrar mensajes al usuario
  emailStatus: 'idle' | 'success' | 'error' = 'idle'; // Para controlar el estado del envío
  responseMessage: string | null = null;
  errorMessage: string | null = null;
  previewUrl: string | null = null; // Para la URL de vista previa de Nodemailer
  private authSubscription: Subscription | undefined; // Para la suscripción al AuthService




  constructor(
    private emailService: EmailService,
    private authService: AuthService // Inyecta el AuthService
  ) { }

  ngOnInit(): void {
    // Suscribirse para obtener el email del usuario logueado
    this.authSubscription = this.authService.getCurrentUserEmail().subscribe(email => {
      if (email) {
        this.emailData.from = email; // Asigna el email del usuario al campo 'from'
      } else {
        // Opcional: Si el usuario no está logueado, puedes dejar el campo vacío,
        // o mostrar un mensaje, o deshabilitar el formulario.
        this.emailData.from = ''; // O podrías poner un valor predeterminado si es necesario
      }
    });
  }

  ngOnDestroy(): void {
    // Es crucial desuscribirse para evitar fugas de memoria, especialmente en Observables de larga vida
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  /**
   * Maneja el envío del formulario.
   */
  sendEmail(): void {
    // Reinicia los mensajes al iniciar un nuevo envío
    this.responseMessage = null;
    this.errorMessage = null;
    this.previewUrl = null;

    // Validación básica del formulario (ahora incluye 'from')
    if (!this.emailData.from || !this.emailData.to || !this.emailData.subject || !this.emailData.text) {
      this.errorMessage = 'Por favor, completa todos los campos requeridos (Remitente, Para, Asunto, Mensaje).';
      return;
    }

    // Llama al servicio para enviar el correo
    this.emailService.sendEmail(this.emailData).subscribe(
      (response) => {
        // En caso de éxito
        this.responseMessage = response.message;
        this.previewUrl = response.previewUrl;
        console.log('Correo enviado exitosamente:', response);
        // Opcional: Limpiar el formulario después de un envío exitoso
        this.emailData.subject = '';
        this.emailData.text = '';
        // Mantener 'from' (email del usuario) y 'to' (destinatario fijo)
      },
      (error) => {
        // En caso de error
        this.errorMessage = error.error?.error || 'Hubo un error al enviar el correo. Inténtalo de nuevo.';
        console.error('Error al enviar el correo:', error);
      }
    );
  }
}
