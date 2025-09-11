import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private apiUrl = `${environment.apiUrl}/send-email`;

  constructor(private http: HttpClient) { }

  sendEmail(emailData: { from: string; to: string; subject: string; text: string; html?: string }): Observable<any> {
    return this.http.post(this.apiUrl, emailData);
  }
}
