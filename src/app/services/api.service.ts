import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';

@Injectable()
export class ApiService {
 
  private apiUrl = 'http://localhost:3000/api'; 

  constructor(private http: HttpClient) { }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = '';
    
    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error: ${error.error.message}`;
      console.error('Error del cliente:', error.error.message);
    } else {
      // El backend devolvió un código de error
      errorMessage = `Código: ${error.status}, Mensaje: ${error.message}`;
      console.error(
        `Backend devolvió código ${error.status}, ` +
        `cuerpo: ${JSON.stringify(error.error)}`);
    }
    
    // Devuelve un observable con un mensaje de error para que la app siga funcionando
    return throwError(() => new Error(errorMessage));
  }

  get(endpoint: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${endpoint}`)
      .pipe(
        retry(1), // Reintenta la solicitud una vez antes de fallar
        catchError(this.handleError)
      );
  }

  post(endpoint: string, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${endpoint}`, data)
      .pipe(
        catchError(this.handleError)
      );
  }

  put(endpoint: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${endpoint}`, data)
      .pipe(
        catchError(this.handleError)
      );
  }

  delete(endpoint: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${endpoint}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  testConnection(): Observable<any> {
    return this.get('test');
  }

  addEvent(event: any): Observable<any> {
    if (!event) {
      return throwError(() => new Error('Datos del evento no proporcionados'));
    }
    return this.post('events', event);
  }

  updateEventFromModal(event: any): Observable<any> {
    if (!event || !event.id) {
      return throwError(() => new Error('ID del evento no proporcionado'));
    }
    return this.put(`events/modal/${event.id}`, event);
  }

  deleteEvent(id: number): Observable<any> {
    if (!id || typeof id !== 'number') {
      console.error('ID inválido:', id);
      return throwError(() => new Error('ID del evento faltante o incorrecto'));
    }
    return this.delete(`events/${id}`);
  }

  getAllEvents(): Observable<any> {
    return this.get('events');
  }
    
  getUserEvents(userId: string): Observable<any[]> {
    if (!userId) {
      return throwError(() => new Error('ID de usuario no proporcionado'));
    }
    return this.http.get<any[]>(`${this.apiUrl}/events/user/${userId}`)
      .pipe(
        catchError(this.handleError)
      );
  }
  
  getAllUsers(): Observable<any[]> {
    return this.get('users');
  }
    
  getUserRole(userId: string): Observable<string> {
    if (!userId) {
      return throwError(() => new Error('ID de usuario no proporcionado'));
    }
    return this.http.get<string>(`${this.apiUrl}/users/${userId}/role`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getUserDetails(userId: string): Observable<any> {
    if (!userId) {
      return throwError(() => new Error('ID de usuario no proporcionado'));
    }
    return this.http.get<any>(`${this.apiUrl}/users/${userId}`)
      .pipe(
        catchError(this.handleError)
      );
  }
}