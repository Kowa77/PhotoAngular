import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private apiUrl = 'http://localhost:3001/send-email'; // Asegúrate de que esta URL coincida con tu backend

  constructor(private http: HttpClient) { }

  // Asegúrate de que la interfaz o tipo de emailData incluye 'from'
  sendEmail(emailData: { from?: string; to: string; subject: string; text: string; html?: string }): Observable<any> {
    return this.http.post(this.apiUrl, emailData);
  }
}
