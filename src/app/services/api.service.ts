import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

@Injectable()
export class ApiService {
  private apiUrl = 'http://localhost:3000/api'; 

  constructor(private http: HttpClient) { }

  get(endpoint: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${endpoint}`);
  }

  post(endpoint: string, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${endpoint}`, data);
  }

  testConnection(): Observable<any> {
    return this.get('test');
  }

  addEvent(event: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/events`, event);
  }

  updateEvent(event: any): Observable<any> {
    if (!event.id || typeof event.id !== 'number') {
      console.error('ID inválido:', event.id);
      return of({ error: 'ID del evento faltante o incorrecto' });
    }
    return this.http.put(`${this.apiUrl}/events/${event.id}`, event);
  }
  
}