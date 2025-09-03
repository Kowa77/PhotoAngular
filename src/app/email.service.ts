// email.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  // Asegúrate de que esta URL apunte a tu nuevo backend
  private apiUrl = 'http://localhost:3000/api/send-email';

  constructor(private http: HttpClient) { }

  sendEmail(emailData: { from: string; to: string; subject: string; text: string; html?: string }): Observable<any> {
    return this.http.post(this.apiUrl, emailData);
  }
}
