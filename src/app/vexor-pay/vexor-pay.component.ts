import { Component, OnInit, Input } from '@angular/core'; // Importa Input
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-vexor-pay',
  templateUrl: './vexor-pay.component.html',
  styleUrls: ['./vexor-pay.component.css'],
  imports: [CommonModule]
})
export class VexorPayComponent implements OnInit {
  @Input() items: any[] = []; // Define 'items' como un Input
  @Input() amountToPay: number = 0; // Asegúrate de tener este Input también
  isPaymentLoading = false;
  paymentError: string | null = null;
  private paymentSubscription?: Subscription;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
  }

  async initiatePayment() {
    this.isPaymentLoading = true;
    this.paymentError = null;

    const payload = {
      items: this.items,
      amount: this.amountToPay,
      currency: 'UYU'
    };

    this.paymentSubscription = this.http.post<any>('https://surprising-friendship-production.up.railway.app/create_payment', payload)
      .subscribe({
        next: (response) => {
          this.isPaymentLoading = false;
          if (response && response.payment_url) {
            window.location.href = response.payment_url;
          } else {
            this.paymentError = 'Error al obtener la URL de pago del servidor.';
          }
        },
        error: (error) => {
          this.isPaymentLoading = false;
          this.paymentError = 'Error al comunicarse con el servidor: ' + error.message;
          console.error('Error al crear el pago en el servidor:', error);
        },
        complete: () => {
          console.log('Petición de pago completada.');
        }
      });
  }

  ngOnDestroy(): void {
    if (this.paymentSubscription) {
      this.paymentSubscription.unsubscribe();
    }
  }
}
