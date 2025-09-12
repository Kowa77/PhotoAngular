import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../../../firebase/firefirebase-service.service';
import { GooglePhotosService } from '../../../google-photos.service';

declare const Swal: any;

@Component({
  selector: 'app-success',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './success.component.html',
  styleUrls: ['./success.component.css']
})
export class SuccessComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private firebaseService = inject(FirebaseService);

  loading = true;
  message = 'Procesando tu pago...';

  // 🔥 datos del resumen
  paymentStatus: string | null = null;
  reservationId: string | null = null;
  userId: string | null = null;
  mode: string | null = null;
  amount: number = 0;
  formattedDate: string | null = null;

  goToAgenda(): void {
    this.router.navigate(['/agenda']);
  }


  async ngOnInit(): Promise<void> {
    const queryParams = this.route.snapshot.queryParams;
    this.paymentStatus = queryParams['status']; // approved, pending, failure
    this.reservationId = queryParams['reservationId'];
    this.userId = queryParams['userId'];
    this.mode = queryParams['mode'];
    this.amount = Number(queryParams['amount'] || 0);
    this.formattedDate = queryParams['date'] || null;

    try {
      if (this.paymentStatus === 'approved' && this.reservationId && this.userId) {
        // 👇 confirmamos en Firebase
        const validMode: 'full' | 'partial' = this.mode === 'partial' ? 'partial' : 'full';
        await this.firebaseService.updateReservationPayment(
          this.reservationId,
          this.userId,
          this.amount,
          validMode
        );

        this.message = '¡Tu pago fue confirmado y la reserva está activa!';
        Swal.fire('Pago exitoso', 'Tu reserva quedó confirmada.', 'success');
      } else if (this.paymentStatus === 'pending') {
        this.message = 'Tu pago está pendiente. Te notificaremos cuando se confirme.';
        Swal.fire('Pago pendiente', 'Tu pago aún no se acreditó.', 'info');
      } else {
        this.message = 'Hubo un problema con tu pago. Intenta de nuevo.';
        Swal.fire('Error', 'El pago no fue aprobado.', 'error');
      }
    } catch (error: any) {
      console.error('Error en success.component:', error);
      this.message = 'Error procesando tu reserva.';
      Swal.fire('Error', error.message || 'No se pudo procesar la reserva', 'error');
    } finally {
      this.loading = false;
    }
  }
}
