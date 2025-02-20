import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ApiService } from '../services/api.service';

/**Interfases generales, sus propiedades son para varias funciones en el codigo */
interface CalendarEvent {
  id: string;
  name: string;
  type: string;
  date: Date;
  startTime: string;
  endTime: string;
  color: string;
  userId: string;
}

interface WeekDay {
  date: Date;
  day: number;
  name: string;
  isToday: boolean;
}

interface ActivityStats {
  estrategica: number;
  administrativa: number;
  operativa: number;
  personal: number;
}

@Component({
  selector: 'app-dashboard-content',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './dashboard-content.component.html',
  styleUrls: ['./dashboard-content.component.css'],
  providers: [ApiService]
})
export class DashboardContentComponent implements OnInit {

  //IMPORTANTE, AQUI ESTAN LAS VARIABLES GLOBALES PARA EL USUARIO 
  currentUser: string = 'porther'; 
  currentUserRole: string = '';
  
  // Propiedad para almacenar la lista de usuarios
  usuarios: any[] = [];
  selectedUser: string | null = null; 

  //Propiedad para el día actual
  today: string = new Date().toISOString().split('T')[0];

  //Api URL
  private apiUrl = 'http://localhost:3000/api';

  //Propiedades generales 
  private readonly BASE_HOUR = 3; // Hora base del calendario (3 AM)
  
  //Propiedades de arrastre (drag) 
  isDragging = false;
  draggedEvent: CalendarEvent | null = null;
  dragStartPosition: { x: number, y: number } = { x: 0, y: 0 };
  dragPreviewElement: HTMLDivElement | null = null;
  dragStartHour: number | null = null;
  dragStartY: number = 0;
  hourHeight: number = 82;
  draggedEventId: string | null = null;
  private dragStartX: number = 0;
  private originalDayIndex: number = -1;
  private dayWidth: number = 0;
  private validDropZone: boolean = false;

//Creacion de eventos mediante arrastre 
  isDragCreating: boolean = false;
  dragStartCell: { day: number, hour: number } | null = null;
  dragEndCell: { day: number, hour: number } | null = null;
  temporaryEventElement: HTMLDivElement | null = null;
  
  currentDate: Date;
  currentMonthName: string;
  currentYear: number;
  calendarDays: { day: number, isCurrentMonth: boolean, isHoliday: boolean }[][] = [];
  day: any;
  time: string = '';
  endDay: string = '';

 //Propiedades para los horarios del evento 
  availableTimes: string[] = [];
  startTime: string = '';
  endTime: string = '';
  
  selectedWeekStart: Date | null = null;
  selectedWeekDays: { day: number, isCurrentMonth: boolean, isHoliday: boolean }[] = [];

  //Redimensionamiento de eventos
  isResizing: boolean = false;
  resizeStartY: number = 0;
  resizeStartTime: string = '';
  resizingEvent: CalendarEvent | null = null;
  resizeType: 'top' | 'bottom' | null = null;
  proposedEventChanges: CalendarEvent | null = null;

  // Propiedades para el modal de edición
  isEditModalOpen: boolean = false;
  editEventName: string = '';
  editActivityType: string = '';
  editDay: string = '';
  editTime: string = '';
  editEndDay: string = '';
  currentEditingEvent: CalendarEvent | null = null;
  currentHoveredEvent: CalendarEvent | null = null;
  events: CalendarEvent[] = [];

//Asignación automatica para los estilos del evento según su tipo
  private typeColors: { [key: string]: { backgroundColor: string, borderColor: string } } = {
    'estrategica': { backgroundColor: '#EFD9D9', borderColor: '#EF0A06' },
    'administrativa': { backgroundColor: '#D8EDD7', borderColor: '#0AD600' },
    'operativa': { backgroundColor: '#CADCF4', borderColor: '#086CF0' },
    'personal': { backgroundColor: '#E4E4E4', borderColor: '#747474' },
    'perso': { backgroundColor: '#ffffff', borderColor: '#000000' } 
  };
  
//Variables del modal de crear evento
  isCreateEventModalOpen: boolean = false;
  isModalOpen: boolean = false; 
  selectedDate: Date | null = null;
  selectedStartTime: string = '';
  selectedEndTime: string = '';
  private originalEventDuration: number = 0;

 //Variables para los porcentajes de cada evento
   activityPercentages: ActivityStats = {
    estrategica: 0,
    administrativa: 0,
    operativa: 0,
    personal: 0
  };
 
  //Variables para la creacion del evento en el modal
   eventName: string = '';
   activityType: string = '';

   //Constructor general del componente
   constructor(private cdr: ChangeDetectorRef, private apiService: ApiService) {
    this.currentDate = new Date();
    this.currentMonthName = this.getMonthName(this.currentDate.getMonth());
    this.currentYear = this.currentDate.getFullYear();
  }
    
 //Ciclo de vida del componente, carga servicios.
 ngOnInit(): void {
  this.apiService.testConnection().subscribe({
    next: (resp) => console.log('Conexion ok', resp),
    error: (err) => console.error('Error', err)
  });
  this.updateCalendar();
  this.generateAvailableTimes();
  // Primero verificamos si el usuario actual existe en la base de datos
  this.apiService.getUserDetails(this.currentUser).subscribe({
    next: (user) => {
      // Si el usuario existe, continuamos con la carga normal
      this.updateCalendar();
      this.generateAvailableTimes();
      this.loadUserEvents();
      this.loadUsers();
      this.loadUserRole();
    },
    error: (err) => {
      // Si el usuario no existe, mostramos la alerta
      Swal.fire({
        icon: 'error',
        title: 'Sesión no válida',
        text: 'El usuario no existe en la base de datos',
        confirmButtonText: 'Entendido'
      });
      console.error('Error de sesión:', err);
    }
  });
}
 // Método para manejar la selección de usuario
 onUserSelect(userId: string): void {
  if (this.currentUserRole !== 'ADMINISTRATIVO') {
    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'warning',
      title: 'No tienes permisos para ver otros usuarios',
      showConfirmButton: false,
      timer: 3000
    });
    return; // Evita que el usuario cambie la selección
  }

  this.selectedUser = userId;

  if (userId) {
    // Mostrar loading mientras se cargan los eventos
    Swal.fire({
      title: 'Cargando actividades...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.apiService.getUserEvents(userId).subscribe({
      next: (events) => {
        this.events = events.map(event => this.normalizeEventData(event));
        this.calculateActivityPercentages();
        Swal.close();

        if (this.events.length === 0) {
          Swal.fire({
            toast: true,
            position: 'top',
            icon: 'info',
            title: 'No hay eventos registrados para este usuario',
            showConfirmButton: false,
            timer: 3000
          });
        }
      },
      error: (error) => {
        console.error('Error al cargar eventos:', error);
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title: 'Error al cargar los eventos del usuario',
          showConfirmButton: false,
          timer: 3000
        });
      }
    });
  } else {
    // Si no hay usuario seleccionado, volver a cargar los eventos del usuario actual
    this.loadUserEvents();
  }
}

// Método actualizado para cargar eventos
loadUserEvents(): void {
  const userToLoad = this.selectedUser || this.currentUser;
  
  Swal.fire({
    title: 'Cargando eventos...',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  this.apiService.getUserEvents(userToLoad).subscribe({
    next: (events) => {
      this.events = events.map(event => this.normalizeEventData(event));
      this.calculateActivityPercentages();
      Swal.close();
      
      if (this.events.length === 0) {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'info',
          title: 'No se encontraron actividades',
          showConfirmButton: false,
          timer: 3000
        });
      }
    },
    error: (error) => {
      console.error('Error al cargar eventos:', error);
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'error',
        title: 'Error al cargar los eventos',
        showConfirmButton: false,
        timer: 3000
      });
    }
  });
}

// Método actualizado para normalizar los datos del evento
private normalizeEventData(event: any): CalendarEvent {
  return {
    id: event.id,
    name: event.name,
    type: event.type,
    date: new Date(event.date),
    startTime: this.convertTimeFormat(event.start_time || event.startTime),
    endTime: this.convertTimeFormat(event.end_time || event.endTime),
    color: this.getEventColor(event.type), // Método auxiliar para obtener el color
    userId: event.userId
  };
}

// Método auxiliar para obtener el color según el tipo de evento
private getEventColor(type: string): string {
  return this.typeColors[type as keyof typeof this.typeColors]?.backgroundColor || '#E4E4E4';
}

//Metodo auxiliar para cargar el rol
loadUserRole(): void {
  this.apiService.getUserRole(this.currentUser).subscribe({
    next: (response: any) => {

      this.currentUserRole = response.role;
      console.log('Rol del usuario:', this.currentUserRole);
      this.cdr.detectChanges(); 
    },
    error: (error) => {
      console.error('Error al cargar el rol del usuario:', error);

      this.currentUserRole = '';
    }
  });
}

//Metodo para convertir los horarios (AM-PM/PM-AM)
private convertTimeFormat(time: string): string {
  if (!time) return '';
  
  // Si ya está en formato AM/PM, retornarlo
  if (time.includes('AM') || time.includes('PM')) return time;
  
  // Convertir la hora
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  
  // Usar padStart para asegurar que tanto horas como minutos tengan dos dígitos
  return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Método para obtener los usuarios
loadUsers(): void {
  this.apiService.getAllUsers().subscribe({
    next: (usuarios) => {
      this.usuarios = usuarios;
    },
    error: (error) => {
      console.error('Error al cargar usuarios:', error);
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'error',
        title: 'Error al cargar usuarios',
        showConfirmButton: false,
        timer: 3000
      });
    }
  });
}

// Agregar esta función para verificar si estamos viendo eventos de otro usuario
private isViewingOtherUserEvents(): boolean {
  return this.selectedUser !== null && this.selectedUser !== this.currentUser;
}

 // Método corregido para manejar la selección de un día
onDaySelect(day: { day: number, isCurrentMonth: boolean, isHoliday: boolean }, weekIndex: number, dayIndex: number): void {
  if (!day.isCurrentMonth) return;

  const selectedDate = new Date(this.currentYear, this.currentDate.getMonth(), day.day);
  
  // Obtener el lunes de la semana (restando los días desde el lunes)
  const dayOfWeek = selectedDate.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Ajuste para que la semana empiece en lunes
  
  // Establecer la fecha al lunes de la semana seleccionada
  selectedDate.setDate(selectedDate.getDate() - daysToMonday);
  
  // Guardar el inicio de la semana seleccionada
  this.selectedWeekStart = new Date(selectedDate);
  
  // Actualizar currentDate para que coincida con la semana seleccionada
  this.currentDate = new Date(this.selectedWeekStart);
  
  // Obtener los 7 días de la semana seleccionada
  this.selectedWeekDays = [];
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(selectedDate.getDate() + i);
    
    // Determinar si el día es del mes actual
    const isCurrentMonth = currentDate.getMonth() === this.currentDate.getMonth();
    
    this.selectedWeekDays.push({
      day: currentDate.getDate(),
      isCurrentMonth: isCurrentMonth,
      isHoliday: false // Mantener el estado de festivo según necesites
    });
  }

  // Actualizar el mes y año actual
  this.currentMonthName = this.getMonthName(this.currentDate.getMonth());
  this.currentYear = this.currentDate.getFullYear();
  
  // Actualizar el calendario
  this.updateCalendar();
  
  // Forzar la actualización de la vista
  this.cdr.detectChanges();
}

// Método actualizado para verificar si un día está en la semana seleccionada
isDayInSelectedWeek(day: { day: number, isCurrentMonth: boolean, isHoliday: boolean }): boolean {
  if (!this.selectedWeekStart) return false;

  const currentDate = new Date(this.currentYear, this.currentDate.getMonth(), day.day);
  const weekEnd = new Date(this.selectedWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6); // Añadir 6 días para llegar al domingo

  // Ajustar la fecha si el día pertenece al mes anterior o siguiente
  if (!day.isCurrentMonth) {
    if (day.day > 20) { // Probablemente es del mes anterior
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else { // Probablemente es del mes siguiente
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }

  // Comparar solo las fechas sin considerar la hora
  const compareDate = currentDate.setHours(0, 0, 0, 0);
  const startDate = new Date(this.selectedWeekStart).setHours(0, 0, 0, 0);
  const endDate = weekEnd.setHours(0, 0, 0, 0);

  return compareDate >= startDate && compareDate <= endDate;
}

  //Metodo para devolver el nombre del mes ccorrespondiente a un indice, 0 para enero, 1 para febrero, etc..
  getMonthName(monthIndex: number): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[monthIndex];
  }

  //Metodo para cambiar el mes con la flechas (+1 para avanzar, - 1 para retroceder)
  changeMonth(direction: number): void {
    const newMonth = this.currentDate.getMonth() + direction;

    if (newMonth > 11) {
      this.currentDate.setFullYear(this.currentDate.getFullYear() + 1); //Avanzar (flecha apuntando a derecha) 
      this.currentDate.setMonth(0);
    } else if (newMonth < 0) {
      this.currentDate.setFullYear(this.currentDate.getFullYear() - 1); //Retroceder (flecha apuntando a izquierda) 
      this.currentDate.setMonth(11);
    } else {
      this.currentDate.setMonth(newMonth);
    }

    this.currentMonthName = this.getMonthName(this.currentDate.getMonth());
    this.currentYear = this.currentDate.getFullYear();
    this.updateCalendar(); //Actualiza el calendario)

    this.cdr.detectChanges(); //Fuerza la deteccion de cambios en la vista 
  }

 //Metodo para actualizar la interfaz del calendario
  updateCalendar(): void {
    //Obtencion de datos del mes actual
    const daysInMonth = new Date(this.currentYear, this.currentDate.getMonth() + 1, 0).getDate(); //Total de días del mes actual
    const firstDayOfMonth = new Date(this.currentYear, this.currentDate.getMonth(), 1).getDay(); //Devuelve el dia de la semana para el primer dia del mes (0 para dom, 6 para sab)
    const lastDayOfMonth = new Date(this.currentYear, this.currentDate.getMonth() + 1, 0).getDay(); //Devuelve el dia de la semana del ultimo del mes 
  
    //Inicializar
    this.calendarDays = [];  //Almacena todas las semanas del mes
    let week: { day: number, isCurrentMonth: boolean, isHoliday: boolean }[] = []; //Array para almacenar cada semana en calendarDays
  
    const holidays = this.getHolidaysForMonth(this.currentYear, this.currentDate.getMonth()); //Lista de dias festivos 
  
   
    const prevMonthDays = new Date(this.currentYear, this.currentDate.getMonth(), 0).getDate(); //Calcula el total de dias del mes anterior
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      week.push({ day: prevMonthDays - i, isCurrentMonth: false, isHoliday: false });
    } 
  
 //Rellenar dias del mes anterior
    for (let day = 1; day <= daysInMonth; day++) {
      const isHoliday = holidays.includes(day);
      week.push({ day, isCurrentMonth: true, isHoliday });
  
      if (week.length === 7) {
        this.calendarDays.push(week);
        week = [];
      }
    }
  
  //Rellenar dias del mes siguiente
    const remainingDays = 7 - week.length;
    for (let i = 1; i <= remainingDays; i++) {
      week.push({ day: i, isCurrentMonth: false, isHoliday: false });
    }
  
  //Agregar ultima semana del mes
    if (week.length > 0) {
      this.calendarDays.push(week);
    }
  }

  //Metodo para los diás festivos
  getHolidaysForMonth(year: number, month: number): number[] {
    const fixedHolidays = [
      { month: 0, day: 1 }, // Año Nuevo
      { month: 4, day: 1 }, // Día del Trabajo
      { month: 6, day: 20 }, // Día de la Independencia
      { month: 7, day: 7 }, // Batalla de Boyacá
      { month: 11, day: 8 }, // Inmaculada Concepción
      { month: 11, day: 25 } // Navidad
    ];
  
    const mobileHolidays = this.calculateMobileHolidays(year);
  
  //Combinar festivos mobiles y fijos
    return [
      ...fixedHolidays.filter(h => h.month === month).map(h => h.day),
      ...mobileHolidays.filter(h => h.month === month).map(h => h.day)
    ];
  }
  
  //fFestivos mobiles
  calculateMobileHolidays(year: number): { month: number, day: number }[] {
    const holidays: { month: number, day: number }[] = [];
  
    //Domingo de pascua
    const easter = this.calculateEasterSunday(year);
  
   //Jueves y viernes santos
    const holyThursday = new Date(easter);
    holyThursday.setDate(easter.getDate() - 3);
    holidays.push({ month: holyThursday.getMonth(), day: holyThursday.getDate() });
  
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    holidays.push({ month: goodFriday.getMonth(), day: goodFriday.getDate() });
  
    //Corpus Cristi
    const corpusChristi = new Date(easter);
    corpusChristi.setDate(easter.getDate() + 60);
    holidays.push({ month: corpusChristi.getMonth(), day: corpusChristi.getDate() });
  
   //Sagrado corazón de Jesús
    const sacredHeart = new Date(easter);
    sacredHeart.setDate(easter.getDate() + 68);
    holidays.push({ month: sacredHeart.getMonth(), day: sacredHeart.getDate() });
  
    //Corrimiento para el día lunes
    holidays.push(...this.getMondayHolidays(year));
  
    return holidays;
  }
  
  //Lunes festivos calculo
  getMondayHolidays(year: number): { month: number, day: number }[] {
    const holidays: { month: number, day: number }[] = [];
  
    //Reyes magoos
    holidays.push(this.getFirstMondayAfter(year, 0, 6));
 
    // San Jose
    holidays.push(this.getFirstMondayAfter(year, 2, 19));
  
    //San Pedro y San Pablo
    holidays.push(this.getFirstMondayAfter(year, 5, 29));
  
    //Asuncion de la virgen
    holidays.push(this.getFirstMondayAfter(year, 7, 15));
  
    //Dia de la raza
    holidays.push(this.getFirstMondayAfter(year, 9, 12));
  
    //Dia de todos lo santos
    holidays.push(this.getFirstMondayAfter(year, 10, 1));
  
    //Independencia de Cartagena
    holidays.push(this.getFirstMondayAfter(year, 10, 11));
  
    return holidays;
  }
  
  //Metodo para encontrar el Lunes luego de una fecha especifica
  getFirstMondayAfter(year: number, month: number, day: number): { month: number, day: number } {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
  
    //Si el dia es Lunes, no se traslada
    if (dayOfWeek === 1) {
      return { month: date.getMonth(), day: date.getDate() };
    }
  
    //Calculo para la llegada del proximo lunes
    const daysToAdd = (8 - dayOfWeek) % 7;
    date.setDate(date.getDate() + daysToAdd);
  
    return { month: date.getMonth(), day: date.getDate() };
  }
  
  //Metodo para calcular el domingo de pascua
  calculateEasterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
  }
  
//Metodo para abrir el modal del evento
 openCreateEventModal(): void {
  if (this.isViewingOtherUserEvents()) return;
  //Resetear los campos al cerrar el modal
  this.eventName = '';
  this.activityType = '';
  
  //Resetear las horas si no vienen del drag
  if (!this.isDragCreating) {
    this.selectedStartTime = '';
    this.selectedEndTime = '';
    this.time = '';
    this.endDay = '';
  }
  
  this.isModalOpen = true;
}

//Metodo para cerrar el modal
closeModal(): void {
  this.isModalOpen = false;
  if (!this.isDragCreating) {
    this.resetForm();
  }
  this.isDragCreating = false; //Reset del flag
}

///Metodo adicional para cerrar el modal al hacer click fuera de él
onModalBackgroundClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) { 
    this.closeModal();
  } 
}

//Metodo para evitar propagacion del modal
onModalContentClick(event: MouseEvent): void {
  event.stopPropagation();
}

//Metodo para el procesamiento y creacion de eventos en el modal
submitForm(): void {
  if (!this.eventName || !this.activityType || !this.selectedDate || !this.selectedStartTime || !this.selectedEndTime) {
    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'warning',
      title: 'Por favor, complete todos los campos.',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
    return;
  }
  //Obtener minutos desde media noche
  const getMinutesFromMidnight = (timeString: string) => {
    const [time, period] = timeString.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (period === 'PM' && hours !== 12) hours += 12;
    else if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  };

  const startMinutes = getMinutesFromMidnight(this.selectedStartTime);
  const endMinutes = getMinutesFromMidnight(this.selectedEndTime);
 //En caso de que en el modal no se digite de forma correcta las horas, avisar y no insertar
  if (endMinutes <= startMinutes) {
    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'error',
      title: 'La hora de finalización debe ser posterior a la de inicio.',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
    return;
  }

  const newEvent: Partial<CalendarEvent> = {
    date: this.selectedDate,
    startTime: this.selectedStartTime,
    endTime: this.selectedEndTime
  };
  //Si existe un evento en ese horario, no insertar
  if (this.checkTimeCollision(newEvent)) {
    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'error',
      title: '¡Ya existe un evento en ese horario!',
      text: 'Seleccione un horario libre que no coincida con otro evento.',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
    return;
  }

  const finalEvent: CalendarEvent = {
    id: Date.now().toString(),
    name: this.eventName,
    type: this.activityType,
    date: this.selectedDate,
    startTime: this.selectedStartTime,
    endTime: this.selectedEndTime,
    color: this.typeColors[this.activityType as keyof typeof this.typeColors].backgroundColor,
    userId: this.currentUser
  };

  //Confirmacion del usuario
  Swal.fire({
    title: '¿Estás seguro de crear el evento?',
    text: `Evento: ${finalEvent.name}, Fecha: ${finalEvent.date}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, crear',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    //Crear evento y enviar a la base de datos
    if (result.isConfirmed) {
      this.apiService.addEvent(finalEvent).subscribe({
        next: (response) => {
          if (response?.id) {
            finalEvent.id = response.id;
            this.events.push(finalEvent);
            this.calculateActivityPercentages();

            Swal.fire({
              toast: true,
              position: 'top',
              icon: 'success',
              title: 'Evento registrado.',
              showConfirmButton: false,
              timer: 3000
            });
          }
          this.closeModal();
        },
        error: (error) => {
          console.error('Error al guardar el evento:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo guardar el evento'
          });
        }
      });
    } else {
      console.log('Creación de evento cancelada');
    }
  });
}

//Resetear campos del formulario al finalizar proceso
resetForm(): void {
  this.eventName = ''; 
  this.activityType = '';
  this.selectedDate = null;
  this.selectedStartTime = '';
  this.selectedEndTime = '';
  this.time = '';
  this.endDay = '';
  this.day = '';
}

//Redimencion de eventos
startResize(event: MouseEvent, calendarEvent: CalendarEvent, type: 'top' | 'bottom') {
  if (this.isViewingOtherUserEvents()) return;
  event.preventDefault(); 
  event.stopPropagation();
  
  this.isResizing = true; //Marca que la redimencion esta activa
  this.resizingEvent = { ...calendarEvent }; //Copia el evento que se redimenciona, evitando dañarlo
  this.resizeStartY = event.clientY; //Guarda la posicion vertical del mouse
  this.resizeType = type; //Define la parte del evento que se redimenciona
  this.resizeStartTime = type === 'top' ? calendarEvent.startTime : calendarEvent.endTime; //Guarda las horas que corresponden
  
  document.body.style.cursor = 'ns-resize'; //Cursor
}

//Ejecuta los movimientos del mouse
@HostListener('document:mousemove', ['$event'])
onMouseMove(event: MouseEvent) {
  //Redimencionamiento de eventos
  if (this.isResizing && this.resizingEvent) {

    //Calculo de movimientos del mouse
    event.preventDefault();
    
    const deltaY = event.clientY - this.resizeStartY;
    const quarterHourHeight = this.hourHeight / 4;
    const quarterHourDelta = Math.round(deltaY / quarterHourHeight); 
    //Convierte una hora en minutos totales
    const getMinutesFromTime = (timeString: string): number => {
      const [time, period] = timeString.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      else if (period === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };
    //Convertir minutos totales a formato hh:mm AM/PM
    const formatTimeWithMinutes = (totalMinutes: number): string => {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const isPM = hours >= 12;
      const displayHours = hours % 12 || 12;
      return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
    };
    //Obtener los minutos de inicio y fin del evento
    const currentStartMinutes = getMinutesFromTime(this.resizingEvent.startTime);
    const currentEndMinutes = getMinutesFromTime(this.resizingEvent.endTime);
    
    //Calcular la nueva hora de inicio o fin del evento
    let newStartMinutes = currentStartMinutes;
    let newEndMinutes = currentEndMinutes;
    

    if (this.resizeType === 'top') {
      newStartMinutes = currentStartMinutes + (quarterHourDelta * 15);
      newStartMinutes = Math.max(
        this.BASE_HOUR * 60,
        Math.min(currentEndMinutes - 15, newStartMinutes)
      );
    } else {
      newEndMinutes = currentEndMinutes + (quarterHourDelta * 15);
      newEndMinutes = Math.max(
        currentStartMinutes + 15,
        Math.min((this.BASE_HOUR + 21) * 60, newEndMinutes)
      );
    }
    
    //Redondear a multiplos de 15 min
    newStartMinutes = Math.round(newStartMinutes / 15) * 15;
    newEndMinutes = Math.round(newEndMinutes / 15) * 15;
    
 
    const hasCollision = this.checkResizeCollision({
      ...this.resizingEvent,
      startTime: formatTimeWithMinutes(newStartMinutes),
      endTime: formatTimeWithMinutes(newEndMinutes)
    });
    // Si no hay colision, actualizar el evento
    if (!hasCollision) {
      const eventIndex = this.events.findIndex(e => e.id === this.resizingEvent?.id);
      
      if (eventIndex !== -1) {
        this.events[eventIndex] = { 
          ...this.events[eventIndex], 
          startTime: formatTimeWithMinutes(newStartMinutes),
          endTime: formatTimeWithMinutes(newEndMinutes)
        };
        this.cdr.detectChanges();
      }
    }
    //Creacion  de eventos con arrastre
  } else if (this.isDragCreating && this.dragStartCell) {
    const cell = this.findTimeCell(event);
    if (cell) {
      this.dragEndCell = {
        day: this.dragStartCell.day,
        hour: cell.hour
      };
      this.updateTemporaryEvent();
    }
  }
}

//Ejecucion al soltar el boton del mouse
@HostListener('document:mouseup', ['$event'])
onMouseUp(event: MouseEvent) {
  //Finalizar redimencionamiento
  if (this.isResizing) {
    //Buscar el evento redimencionado
    const eventIndex = this.events.findIndex(e => e.id === this.resizingEvent?.id);
    //Confirmacion 
    if (eventIndex !== -1) {
      this.isResizing = false;
      document.body.style.cursor = 'default';
      Swal.fire({
        title: '¿Estás seguro?',
        text: '¿Deseas modificar el horario del evento?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, modificar',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        //Si el usuario confirma la modificacion, actualizar
        if (result.isConfirmed) {
          this.apiService.updateEventFromModal(this.events[eventIndex]).subscribe({
            next: response => {
              Swal.fire({
                toast: true,
                position: 'top',
                icon: 'success',
                title: 'Evento actualizado correctamente',
                showConfirmButton: false,
                timer: 3000
              });
              this.calculateActivityPercentages();
              this.cdr.detectChanges();
            },
            error: error => {
              console.error('Error de actualización:', error);
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo actualizar el evento',
              });
            }
          });
          //Si la cancela, el evento se restaura a su estado original
        } else {
          this.events[eventIndex] = { 
            ...this.resizingEvent 
          } as CalendarEvent;
          this.cdr.detectChanges();
        }
      
        this.resizingEvent = null;
        this.resizeType = null;
      });
    }
    //Finalizacion de la creacion de un evento por arrastre
  } else if (this.isDragCreating && this.dragStartCell && this.dragEndCell) {
    //Obtener fechas seleccionadas
    const weekDays = this.getWeekDays();
    const selectedDate = weekDays[this.dragStartCell.day].date;
    
    //Calcular hora de inicio y fin del evento
    const startHour = Math.min(this.dragStartCell.hour, this.dragEndCell.hour) - 1;
    const endHour = Math.max(this.dragStartCell.hour, this.dragEndCell.hour);
    
    //Formatear fecha y las horas
    this.selectedDate = selectedDate;
    this.day = this.formatDate(selectedDate);
    this.selectedStartTime = this.formatTimeString(startHour);
    this.selectedEndTime = this.formatTimeString(endHour);
    this.time = this.selectedStartTime;
    this.endDay = this.selectedEndTime;
    
    this.openCreateEventModal();
    this.cleanupDragCreate();
  }
}

// INACTIVO: Esto realiza el proceso de arrastrar evento de dia y horas.
  private finalizeDragDrop() {
    const eventElements = document.querySelectorAll('.event-dragging, .valid-drop, .invalid-drop');
    eventElements.forEach(el => {
      el.classList.remove('event-dragging', 'valid-drop', 'invalid-drop');
    });

    this.isDragging = false;
    this.draggedEvent = null;
    this.validDropZone = false;
    this.dragStartHour = null;
    this.dragStartY = 0;
    this.dragStartX = 0;
    this.originalDayIndex = -1;
    this.cdr.detectChanges();
  }

//Metodo auxiliar para formatear la hora
private formatTimeString(hour: number): string {
  const adjustedHour = hour % 24;
  const isPM = adjustedHour >= 12;
  const displayHour = adjustedHour > 12 ? adjustedHour - 12 : (adjustedHour === 0 ? 12 : adjustedHour);
  return `${displayHour.toString().padStart(2, '0')}:00 ${isPM ? 'PM' : 'AM'}`;
}

 // Método para abrir el modal de edición
 openEditModal(event: CalendarEvent) {
  if (this.isViewingOtherUserEvents()) return;
  this.currentEditingEvent = event;
  this.editEventName = event.name;
  this.editActivityType = event.type;
  
  // Formateamos la fecha para el input date (YYYY-MM-DD)
  const eventDate = new Date(event.date);
  const year = eventDate.getFullYear();
  const month = String(eventDate.getMonth() + 1).padStart(2, '0');
  const day = String(eventDate.getDate()).padStart(2, '0');
  this.editDay = `${year}-${month}-${day}`;
  
  this.editTime = event.startTime;
  this.editEndDay = event.endTime;
  this.isEditModalOpen = true;
}

// Método para cerrar el modal de edición
closeEditModal(): void {
  this.isEditModalOpen = false;
  this.currentEditingEvent = null;
  this.resetEditForm();
}

// Resetear el formulario de edición
resetEditForm(): void {
  this.editEventName = '';
  this.editActivityType = '';
  this.editDay = '';
  this.editTime = '';
  this.editEndDay = '';
}

// Método para cerrar el modal al hacer click fuera de él
onEditModalBackgroundClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    this.closeEditModal();
  }
}

// Método para evitar propagación del modal hacia el fondo
onEditModalContentClick(event: MouseEvent): void {
  event.stopPropagation();
}


// Manejo de cambios en la fecha de edición
onEditDateChange(event: any): void {
  // Obtenemos el valor directo del input date
  const selectedDateStr = event.target.value; // Esto viene en formato YYYY-MM-DD
  
  // Creamos la fecha manteniendo la zona horaria local
  const selectedDate = new Date(selectedDateStr + 'T12:00:00');
  
  // Asignamos directamente el string de la fecha al editDay
  this.editDay = selectedDateStr;
}

// Manejo de cambios en la hora de inicio de edición
onEditStartTimeChange(value: string): void {
  this.editTime = value;
}

// Manejo de cambios en la hora de fin de edición
onEditEndTimeChange(value: string): void {
  this.editEndDay = value;
}

// Método para actualizar el evento
updateEvent(): void {
  // Validación de campos requeridos
  if (!this.editEventName || !this.editActivityType || !this.editDay || !this.editTime || !this.editEndDay) {
    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'warning',
      title: 'Por favor, complete todos los campos.',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
    return;
  }

  // Función auxiliar para convertir tiempo a minutos
  const getMinutesFromMidnight = (timeString: string) => {
    const [time, period] = timeString.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (period === 'PM' && hours !== 12) hours += 12;
    else if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  };

  // Validación de horarios
  const startMinutes = getMinutesFromMidnight(this.editTime);
  const endMinutes = getMinutesFromMidnight(this.editEndDay);

  if (endMinutes <= startMinutes) {
    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'error',
      title: 'La hora de finalización debe ser posterior a la de inicio.',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
    return;
  }

  if (this.currentEditingEvent) {
    // Creamos la fecha a partir del string del input date
    const selectedDate = new Date(this.editDay + 'T12:00:00');

    const updatedEvent: CalendarEvent = {
      ...this.currentEditingEvent,
      name: this.editEventName,
      type: this.editActivityType,
      date: selectedDate,
      startTime: this.editTime,
      endTime: this.editEndDay,
      color: this.typeColors[this.editActivityType as keyof typeof this.typeColors].backgroundColor
    };

    // Verificación de colisiones de tiempo
    const otherEvents = this.events.filter(e => e.id !== this.currentEditingEvent?.id);
    const hasCollision = otherEvents.some(e => {
      const sameDate = new Date(e.date).toDateString() === new Date(updatedEvent.date).toDateString();
      if (!sameDate) return false;

      const eventStart = getMinutesFromMidnight(e.startTime);
      const eventEnd = getMinutesFromMidnight(e.endTime);
      return (startMinutes < eventEnd && endMinutes > eventStart);
    });

    if (hasCollision) {
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'error',
        title: '¡Ya existe un evento en ese horario!',
        text: 'Por favor, seleccione un horario disponible.',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
      return;
    }

    // Confirmación antes de actualizar
    Swal.fire({
      title: '¿Estás seguro de modificar el evento?',
      text: `Evento: ${updatedEvent.name}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, modificar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        // Llamada al API Service
        this.apiService.updateEventFromModal(updatedEvent).subscribe({
          next: (response) => {
            const eventIndex = this.events.findIndex(e => e.id === this.currentEditingEvent?.id);
            if (eventIndex !== -1) {
              this.events[eventIndex] = updatedEvent;
              
              Swal.fire({
                toast: true,
                position: 'top',
                icon: 'success',
                title: 'Evento actualizado correctamente',
                showConfirmButton: false,
                timer: 3000
              });

              this.calculateActivityPercentages();
              this.closeEditModal();
              this.cdr.detectChanges();
            }
          },
          error: (error) => {
            console.error('Error al actualizar el evento:', error);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudo actualizar el evento. Por favor, intente nuevamente.',
              showConfirmButton: true
            });
          }
        });
      }
    });
  }
}

//Manejo preciso de clicks para la creacion de eventos por arrastre
startDragEvent(event: MouseEvent, calendarEvent: CalendarEvent) {
  if (this.isViewingOtherUserEvents()) return;

  event.preventDefault();
  
  // Solo proceder si es click izquierdo (botón 0)
  if (event.button === 0) {
    let initialX = event.clientX;
    let initialY = event.clientY;
    let isDragging = false;

    const mouseMoveHandler = (moveEvent: MouseEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - initialX);
      const deltaY = Math.abs(moveEvent.clientY - initialY);

      if (deltaX > 5 || deltaY > 5) {
        isDragging = true;
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
        this.initiateDrag(event, calendarEvent);
      }
    };

    const mouseUpHandler = () => {
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);

      if (!isDragging) {
        this.openEditModal(calendarEvent);
      }
    };

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
  }
  
  // Detectar click derecho (botón 2)
  if (event.button === 2) {
    event.stopPropagation();
    
    // Remover cualquier menú contextual existente
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
      document.body.removeChild(existingMenu);
    }
    
    // Crear el nuevo menú contextual
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.style.position = 'fixed';
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.backgroundColor = 'white';
    contextMenu.style.border = '1px solid #ccc';
    contextMenu.style.borderRadius = '4px';
    contextMenu.style.padding = '8px 0';
    contextMenu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    contextMenu.style.zIndex = '1000';

    // Opciones del menú
    const options = [
      { text: 'Eliminar evento', action: () => this.deleteEvent(calendarEvent) },
      { text: 'Cambiar tipo', subOptions: [
        { text: 'Estratégica', action: () => this.changeEventType(calendarEvent, 'estrategica') },
        { text: 'Administrativa', action: () => this.changeEventType(calendarEvent, 'administrativa') },
        { text: 'Operativa', action: () => this.changeEventType(calendarEvent, 'operativa') },
        { text: 'Personal', action: () => this.changeEventType(calendarEvent, 'personal') }
      ]}
    ];

    // Crear las opciones del menú
    options.forEach(option => {
      const item = document.createElement('div');
      item.className = 'context-menu-item';
      item.style.padding = '8px 16px';
      item.style.cursor = 'pointer';
      item.style.whiteSpace = 'nowrap';
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      
      const text = document.createElement('span');
      text.textContent = option.text;
      item.appendChild(text);

      if (option.subOptions) {
        const arrow = document.createElement('span');
        arrow.textContent = '►';
        arrow.style.marginLeft = '8px';
        arrow.style.fontSize = '10px';
        item.appendChild(arrow);
      }

      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f0f0f0';
        
        // Remover submenú existente
        const existingSubMenu = document.querySelector('.sub-menu');
        if (existingSubMenu) {
          existingSubMenu.remove();
        }
        
        if (option.subOptions) {
          const subMenu = document.createElement('div');
          subMenu.className = 'sub-menu';
          subMenu.style.position = 'absolute';
          subMenu.style.left = '100%';
          subMenu.style.top = item.offsetTop + 'px';
          subMenu.style.backgroundColor = 'white';
          subMenu.style.border = '1px solid #ccc';
          subMenu.style.borderRadius = '4px';
          subMenu.style.padding = '8px 0';
          subMenu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

          option.subOptions.forEach(subOption => {
            const subItem = document.createElement('div');
            subItem.className = 'context-menu-item';
            subItem.textContent = subOption.text;
            subItem.style.padding = '8px 16px';
            subItem.style.cursor = 'pointer';
            
            subItem.addEventListener('mouseenter', () => {
              subItem.style.backgroundColor = '#f0f0f0';
            });
            
            subItem.addEventListener('mouseleave', () => {
              subItem.style.backgroundColor = 'transparent';
            });
            
            subItem.addEventListener('click', (e) => {
              e.stopPropagation();
              subOption.action();
              document.body.removeChild(contextMenu);
            });
            
            subMenu.appendChild(subItem);
          });
          
          item.appendChild(subMenu);
        }
      });

      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'transparent';
      });

      if (!option.subOptions) {
        item.addEventListener('click', () => {
          option.action();
          document.body.removeChild(contextMenu);
        });
      }

      contextMenu.appendChild(item);
    });

    // Agregar el menú al documento
    document.body.appendChild(contextMenu);

    // Función para cerrar el menú
    const closeContextMenu = (e: MouseEvent) => {
      if (!contextMenu.contains(e.target as Node)) {
        if (document.body.contains(contextMenu)) {
          document.body.removeChild(contextMenu);
        }
        document.removeEventListener('mousedown', closeContextMenu);
      }
    };

    // Agregar el event listener inmediatamente
    document.addEventListener('mousedown', closeContextMenu);

    // Prevenir que el menú contextual del navegador aparezca
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    }, { once: true });

    return;
  } else {
    this.initiateDrag(event, calendarEvent);
  }
}

// Nuevo método para cambiar el tipo de evento
changeEventType(event: CalendarEvent, newType: string): void {
  Swal.fire({
    title: '¿Cambiar tipo de evento?',
    text: `¿Deseas cambiar el tipo de evento a ${newType}?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, cambiar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      const updatedEvent: CalendarEvent = {
        ...event,
        type: newType,
        color: this.typeColors[newType as keyof typeof this.typeColors].backgroundColor
      };

      this.apiService.updateEventFromModal(updatedEvent).subscribe({
        next: () => {
          const eventIndex = this.events.findIndex(e => e.id === event.id);
          if (eventIndex !== -1) {
            this.events[eventIndex] = updatedEvent;
            
            Swal.fire({
              toast: true,
              position: 'top',
              icon: 'success',
              title: 'Tipo de evento actualizado',
              showConfirmButton: false,
              timer: 3000
            });

            this.calculateActivityPercentages();
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('Error al actualizar el tipo de evento:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar el tipo de evento',
            showConfirmButton: true
          });
        }
      });
    }
  });
}

// Nuevo método para iniciar el arrastre
private initiateDrag(event: MouseEvent, calendarEvent: CalendarEvent) {
  this.isDragging = true;
  this.draggedEvent = { ...calendarEvent };
  
  this.dragStartX = event.clientX;
  this.dragStartY = event.clientY;
  this.dragStartHour = this.timeStringToHour(calendarEvent.startTime);
  
  const startMinutes = this.timeStringToMinutes(calendarEvent.startTime);
  const endMinutes = this.timeStringToMinutes(calendarEvent.endTime);
  this.originalEventDuration = (endMinutes - startMinutes) / 60;
  
  const weekDays = this.getWeekDays();
  const eventDate = new Date(calendarEvent.date);
  this.originalDayIndex = weekDays.findIndex(day => 
    day.date.toDateString() === eventDate.toDateString()
  );
  
  const calendarElement = document.querySelector('.calendar');
  if (calendarElement) {
    this.dayWidth = calendarElement.getBoundingClientRect().width / 7;
  }
  
  const eventElement = event.target as HTMLElement;
  eventElement.classList.add('event-dragging');
}

//Metodo para hayar el día en el que se posiciona el mouse
findTargetDay(event: MouseEvent): WeekDay | null {
  const weekDays = this.getWeekDays();
  const calendarElement = document.querySelector('.calendar');

  if (!calendarElement) return null;
  const calendarRect = calendarElement.getBoundingClientRect();
  const mouseX = event.clientX - calendarRect.left;
  const dayWidth = calendarRect.width / 7;
  const dayIndex = Math.floor(mouseX / dayWidth);

  return dayIndex >= 0 && dayIndex < weekDays.length ? weekDays[dayIndex] : null;
}

//Actualizar fecha del evento especificado con la nueva fecha
updateEventDate(event: CalendarEvent, targetDay: WeekDay) {
  const originalIndex = this.events.findIndex(e => e.id === event.id);
  if (originalIndex !== -1) {

    this.events[originalIndex] = {
      ...this.events[originalIndex],
      date: targetDay.date
    };
    this.calculateActivityPercentages();
  }
}

//Filtrar y devolver los eventos que corresponden a un dia en especifico
getEventsForDay(weekDay: WeekDay): CalendarEvent[] {
  return this.events.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate.getDate() === weekDay.date.getDate() &&
           eventDate.getMonth() === weekDay.date.getMonth() &&
           eventDate.getFullYear() === weekDay.date.getFullYear();
  });
}

//Verifica si existe un evento en una hora especifica
hasEventAtHour(weekDay: WeekDay, hour: number): CalendarEvent | null {
  const events = this.getEventsForDay(weekDay);
  return events.find(event => {
    const startHour = this.getHourFromTimeString(event.startTime);
    const endHour = this.getHourFromTimeString(event.endTime);
    return hour === startHour;
  }) || null;
}

//Convierte un string de horas de 12 a 24
private getHourFromTimeString(timeString: string): number {
  if (!timeString) return this.BASE_HOUR;

  const [time, period] = timeString.split(' ');
  
  // Verifica si el periodo está presente (AM/PM)
  if (!period || (period !== 'AM' && period !== 'PM')) {
    console.error('Formato de hora incorrecto, falta AM/PM:', timeString);
    return this.BASE_HOUR;
  }

  let [hours] = time.split(':').map(Number);

  if (isNaN(hours)) {
    console.error('Formato de hora incorrecto:', timeString);
    return this.BASE_HOUR;
  }

  /** Convertir a formato de 24 horas */
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours;
}

/**VERIFICA SI EL EVENTO PROPORCIONADO OCURRE A UNA HORA ESPECIFICA, HACIENDO UNA COMPARACION Y SI COINCIDE DEUVELVE TRUE */
isEventInHour(event: CalendarEvent, hour: number): boolean {
  const startHour = this.getHourFromTimeString(event.startTime);
  const endHour = this.getHourFromTimeString(event.endTime);
/**SOLO TRUE PARA LA HORA DEL EVENTO */
  return hour === startHour + 1;
}

//Estilos del tipo de evento.
getEventStyle(event: CalendarEvent): any {
  // Llamar a normalizedEvent para la recarga de la pagina
  const normalizedEvent = this.normalizeEventData(event);
  
  if (!normalizedEvent.startTime || !normalizedEvent.endTime) {
    console.error('startTime or endTime not defined for event:', normalizedEvent);
    return {};
  }

  const startHour = this.getHourFromTimeString(normalizedEvent.startTime);
  const endHour = this.getHourFromTimeString(normalizedEvent.endTime);
  
  const [startMinutes, endMinutes] = [
    normalizedEvent.startTime.includes(':') ? parseInt(normalizedEvent.startTime.split(':')[1].split(' ')[0]) : 0,
    normalizedEvent.endTime.includes(':') ? parseInt(normalizedEvent.endTime.split(':')[1].split(' ')[0]) : 0
  ];

  const minuteOffset = startMinutes / 60;
  const minuteDuration = ((endHour - startHour) * 60 + (endMinutes - startMinutes)) / 60;

  const eventColor = this.typeColors[normalizedEvent.type];

  return {
    position: 'absolute',
    top: `${minuteOffset * 82}px`,
    left: '0',
    right: '0',
    height: `${minuteDuration * 82}px`,
    backgroundColor: eventColor.backgroundColor,
    borderLeft: `8px solid ${eventColor.borderColor}`,
    color: eventColor.borderColor,
    padding: '4px',
    zIndex: 1,
    overflow: 'hidden',
    cursor: this.isResizing ? 'ns-resize' : 'grab',
    userSelect: 'none',
    margin: '0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    onmouseenter: () => this.onEventMouseEnter(normalizedEvent),
    onmouseleave: () => this.onEventMouseLeave()
  };
}

//Metodo para borrar el evento desde el modal de actualizacion.
deleteEventFromModal(): void {
  if (this.currentEditingEvent) {
    // Llamamos al método deleteEvent existente
    this.deleteEvent(this.currentEditingEvent);
    // Cerramos el modal después de iniciar el proceso de eliminación
    this.closeEditModal();
  }
}

// Método para cuando el mouse entra en un evento
onEventMouseEnter(event: CalendarEvent): void {
  this.currentHoveredEvent = event;
  // Agregar el listener de teclado solo cuando estamos sobre un evento
  document.addEventListener('keyup', this.handleKeyPress);
}

// Método para cuando el mouse sale de un evento
onEventMouseLeave(): void {
  this.currentHoveredEvent = null;
  // Remover el listener cuando salimos del evento
  document.removeEventListener('keyup', this.handleKeyPress);
}

// Método para manejar la tecla precionada
 handleKeyPress = (e: KeyboardEvent) => {
  if (e.key === 'Delete' && this.currentHoveredEvent) {
    this.deleteEvent(this.currentHoveredEvent);
  }
}

// Método para eliminar el evento
 deleteEvent(event: CalendarEvent): void {
  if (this.isViewingOtherUserEvents()) return;
  Swal.fire({
    title: '¿Estás seguro de eliminar este evento?',
    text: `Evento: ${event.name}`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      // Asumiendo que event.id es un número
      const eventId = Number(event.id);
      
      this.apiService.deleteEvent(eventId).subscribe({
        next: () => {
          // Eliminar el evento del array local usando el id
          this.events = this.events.filter(e => e.id !== event.id);
          
          Swal.fire({
            toast: true,
            position: 'top',
            icon: 'success',
            title: 'Evento eliminado correctamente',
            showConfirmButton: false,
            timer: 3000
          });
          
          this.calculateActivityPercentages();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error al eliminar el evento:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo eliminar el evento. Por favor, intente nuevamente.',
            showConfirmButton: true
          });
        }
      });
    }
  });
}

  //Metodo para formatear el rango de horas de un evento en el formato AM/PM
 formatEventTime(event: CalendarEvent): string {
    return `${event.startTime} - ${event.endTime}`;
  }

  //Metodo para retornar un rango de fechas que representa la semana actual
  getWeekRange(): string {
    const startOfWeek = this.getStartOfWeek(this.currentDate);
    const endOfWeek = this.getEndOfWeek(this.currentDate);
    const startMonth = this.getMonthName(startOfWeek.getMonth());
    const endMonth = this.getMonthName(endOfWeek.getMonth());
    return `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${this.currentYear}`;
  }
  
  //Metodo para encontrar el lunes de la semana a la que pertenece la fecha dada (date)
  getStartOfWeek(date: Date): Date {
    const startOfWeek = new Date(date);
    const dayOfWeek = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
    startOfWeek.setDate(diff);
    return startOfWeek;
  }
  
  //Metodo para encontrar el fin de una semana de una fecha dada (date)
  getEndOfWeek(date: Date): Date {
    const startOfWeek = this.getStartOfWeek(date);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return endOfWeek;
  }

  //Metodo para cambiar de semana
  changeWeek(direction: number): void {
    // Si hay una semana seleccionada, usar esa fecha como punto de partida
    const referenceDate = this.selectedWeekStart || this.currentDate;
    const newDate = new Date(referenceDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    
    // Actualizar tanto currentDate como selectedWeekStart
    this.currentDate = new Date(newDate);
    this.selectedWeekStart = this.getStartOfWeek(newDate);
    
    // Actualizar el mes y año
    this.currentMonthName = this.getMonthName(this.currentDate.getMonth());
    this.currentYear = this.currentDate.getFullYear();
    
    // Actualizar el calendario
    this.updateCalendar();
    
    // Actualizar selectedWeekDays
    const startOfWeek = this.getStartOfWeek(newDate);
    this.selectedWeekDays = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      
      const dayInCalendar = {
        day: currentDate.getDate(),
        isCurrentMonth: currentDate.getMonth() === this.currentDate.getMonth(),
        isHoliday: false 
      };
      
      this.selectedWeekDays.push(dayInCalendar);
    }
    
    this.cdr.detectChanges();
  }
  
  //Metodo para obtener el numero de la semana
  getWeekNumber(date: Date): number {
    const startDate = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + 1) / 7);
  }

  // Método para obtener los días de la semana (lunes a domingo)
  getWeekDays(): WeekDay[] {
    const startOfWeek = this.getStartOfWeek(this.currentDate);
    const weekDays: WeekDay[] = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + i);
      
      weekDays.push({ 
        date: currentDay,
        day: currentDay.getDate(),
        name: this.getDayName(currentDay.getDay()),
        isToday: currentDay.toDateString() === new Date().toDateString()
      });
    }
    
    return weekDays;
  }

// Método para obtener el nombre del día
getDayName(dayIndex: number): string {
  const daysOfWeek = [
    'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'
  ];
  return daysOfWeek[dayIndex];
}

//Metodo para generar los horarios disponibles
generateAvailableTimes(): void {
  const times: string[] = [];
  
  // Generar horas desde BASE_HOUR (3 AM) hasta 12 AM del día siguiente
  for (let hour = this.BASE_HOUR; hour < this.BASE_HOUR + 21; hour++) {
    const adjustedHour = hour % 24; // Asegura que las horas estén en el rango 0-23
    const isPM = adjustedHour >= 12;
    const displayHour = adjustedHour > 12 ? adjustedHour - 12 : (adjustedHour === 0 ? 12 : adjustedHour);
    
    // Añadir intervalos de 15 minutos
    ['00', '15', '30', '45'].forEach(minute => {
      times.push(`${displayHour.toString().padStart(2, '0')}:${minute} ${isPM ? 'PM' : 'AM'}`);
    });
  }
  
  this.availableTimes = times;
}

 //Metodo para activar el click en un campo de entrada de fecha
onDateClick(event: Event): void {
  const inputElement = event.target as HTMLInputElement;
  const selectedValue = inputElement.value;
  const selectedDate = new Date(selectedValue);
  this.selectedDate = selectedDate;
  this.day = this.formatDate(selectedDate);
}


//Metodo para cambiar la fecha en un campo de entrada
onDateChange(event: any): void {
  const selectedValue = event.target.value;
  const [year, month, day] = selectedValue.split('-').map(Number);
  this.selectedDate = new Date(year, month - 1, day);
  this.day = selectedValue;
}

//Metodo que se ejecuta cuando cambia la hora de inicio en un evento
onStartTimeChange(value: string): void {
  this.selectedStartTime = value;
  this.time = value;
}

//Metodo que se ejecuta cuando cambia la hora de fin de un evento
onEndTimeChange(value: string): void {
  this.selectedEndTime = value;
  this.endDay = value;
}

//Metodo para formatear la fecha en un objeto date en cadena AM/PM
private formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

//Metodo para verificar las colisiones de tiempo
private checkTimeCollision(newEvent: Partial<CalendarEvent>): boolean {
  const newStartTime = newEvent.startTime || '';
  const newEndTime = newEvent.endTime || '';
  const newDate = newEvent.date;

  const getMinutesFromMidnight = (timeString: string): number => {
    const [time, period] = timeString.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    else if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const newStartMinutes = getMinutesFromMidnight(newStartTime);
  const newEndMinutes = getMinutesFromMidnight(newEndTime);

  return this.events.some(existingEvent => {
    if (existingEvent.date.toDateString() !== newDate?.toDateString()) return false;

    const existingStartMinutes = getMinutesFromMidnight(existingEvent.startTime);
    const existingEndMinutes = getMinutesFromMidnight(existingEvent.endTime);

    // Cambiado para permitir eventos que coinciden exactamente en los límites
    return (
      (newStartMinutes > existingStartMinutes && newStartMinutes < existingEndMinutes) ||
      (newEndMinutes > existingStartMinutes && newEndMinutes < existingEndMinutes) ||
      (newStartMinutes < existingStartMinutes && newEndMinutes > existingEndMinutes)
    );
  });
}

//Metodo para verificar las colisiones al redimencionar eventos
private checkResizeCollision(proposedEvent: CalendarEvent): boolean {

  const eventsOnSameDay = this.events.filter(event => 
    event.id !== proposedEvent.id && 
    new Date(event.date).toDateString() === new Date(proposedEvent.date).toDateString()
  );

  const getMinutesFromTime = (timeString: string): number => {
    const [time, period] = timeString.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    else if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const proposedStart = getMinutesFromTime(proposedEvent.startTime);
  const proposedEnd = getMinutesFromTime(proposedEvent.endTime);

  return eventsOnSameDay.some(event => {
    const eventStart = getMinutesFromTime(event.startTime);
    const eventEnd = getMinutesFromTime(event.endTime);

    return (proposedStart < eventEnd && proposedEnd > eventStart);
  });
}

// Método auxiliar para convertir tiempo en formato "HH:MM AM/PM" a número de hora
private timeStringToHour(timeString: string): number {
  const [time, period] = timeString.split(' ');
  let [hours] = time.split(':').map(Number);
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return hours;
}

//Metodo para calcular la duracion de un evento
private calculateEventDuration(event: CalendarEvent): number {
  const startMinutes = this.timeStringToMinutes(event.startTime);
  const endMinutes = this.timeStringToMinutes(event.endTime);
  // Retorna la duración en horas (como número decimal)
  return (endMinutes - startMinutes) / 60;
}

// Método para calcular los porcentajes
private calculateActivityPercentages(): void {
  // Objeto para almacenar las horas totales por tipo de actividad
  const hoursPerActivity: ActivityStats = {
    estrategica: 0,
    administrativa: 0,
    operativa: 0,
    personal: 0
  };

  // Calcular horas totales por tipo de actividad
  let totalHours = 0;
  
  this.events.forEach(event => {
    const duration = this.calculateEventDuration(event);
    hoursPerActivity[event.type as keyof ActivityStats] += duration;
    totalHours += duration;
  });

  // Si no hay eventos, establecer todos los porcentajes a 0
  if (totalHours === 0) {
    this.activityPercentages = {
      estrategica: 0,
      administrativa: 0,
      operativa: 0,
      personal: 0
    };
    return;
  }

  // Calcular porcentajes
  Object.keys(hoursPerActivity).forEach(type => {
    const percentage = (hoursPerActivity[type as keyof ActivityStats] / totalHours) * 100;
    this.activityPercentages[type as keyof ActivityStats] = Math.round(percentage);
  });

  // Forzar actualización de la vista
  this.cdr.detectChanges();
}

//Manejo de clicks para redimencionamiento
@HostListener('mousedown', ['$event'])
onCalendarMouseDown(event: MouseEvent) {
  if (event.button !== 0 || this.isModalOpen) return; // Solo permitir click izquierdo

  const cell = this.findTimeCell(event);
  if (!cell) return;

  const weekDays = this.getWeekDays();
  const selectedDate = weekDays[cell.day].date;

  if (this.isDateBeforeToday(selectedDate)) {
    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'warning',
      title: 'No se pueden crear eventos en días pasados',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
    return;
  }

  const tempEvent: Partial<CalendarEvent> = {
    date: selectedDate,
    startTime: this.formatTimeStringWithMinutes(Math.floor(cell.hour), 0),
    endTime: this.formatTimeStringWithMinutes(Math.floor(cell.hour + 1), 0)
  };

  if (!this.checkTimeCollision(tempEvent)) {
    this.isDragCreating = true;
    this.dragStartCell = cell;
    this.createTemporaryEvent(event);
    event.preventDefault();
  }
}

//Movimiento del mouse
@HostListener('mousemove', ['$event'])
onCalendarMouseMove(event: MouseEvent) {
  if (event.button !== 0 || this.isModalOpen) return; // Solo permitir si el botón izquierdo está presionado

  if (this.isDragCreating && this.dragStartCell) {
    const cell = this.findTimeCell(event);
    if (cell) {
      this.dragEndCell = {
        day: this.dragStartCell.day,
        hour: cell.hour
      };
      this.updateTemporaryEvent();
    }
  }
}

@HostListener('mouseup', ['$event'])
onCalendarMouseUp(event: MouseEvent) {
  if (event.button !== 0) return; // Solo permitir click izquierdo

  if (this.isDragCreating && this.dragStartCell && this.dragEndCell) {
    const weekDays = this.getWeekDays();
    const selectedDate = weekDays[this.dragStartCell.day].date;
    
    const startHour = Math.min(this.dragStartCell.hour, this.dragEndCell.hour);
    const endHour = Math.max(this.dragStartCell.hour, this.dragEndCell.hour);
    
    const startMinutes = Math.round((this.dragStartCell.hour % 1) * 60);
    const endMinutes = Math.round((this.dragEndCell.hour % 1) * 60);
    
    const startMin = Math.round(startMinutes / 15) * 15;
    const endMin = Math.round(endMinutes / 15) * 15;
    
    this.selectedDate = selectedDate;
    this.day = this.formatDate(selectedDate);
    
    this.selectedStartTime = this.formatTimeStringWithMinutes(Math.floor(startHour), startMin);
    this.selectedEndTime = this.formatTimeStringWithMinutes(Math.floor(endHour), endMin);
    this.time = this.selectedStartTime;
    this.endDay = this.selectedEndTime;
    
    this.openCreateEventModal();
  }
  
  this.cleanupDragCreate();
}

//Formatear los minutos de un string
private formatTimeStringWithMinutes(hour: number, minutes: number): string {
  const adjustedHour = hour % 24;
  const isPM = adjustedHour >= 12;
  const displayHour = adjustedHour > 12 ? adjustedHour - 12 : (adjustedHour === 0 ? 12 : adjustedHour);
  return `${displayHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
}

//Metodo para encontrar la celda de tiempo en la que se realiza el redimencionamiento
private findTimeCell(event: MouseEvent): { day: number, hour: number } | null {
  const calendarGrid = document.querySelector('.calendar');
  if (!calendarGrid) return null;

  const rect = calendarGrid.getBoundingClientRect();
  const calendarScrollTop = (calendarGrid as Element).scrollTop || 0;
  const windowScrollY = window.scrollY;
  
  let target = event.target as HTMLElement;
  while (target && !target.classList.contains('hour')) {
    target = target.parentElement as HTMLElement;
  }

  if (!target) return null;

  const dayIndex = parseInt(target.getAttribute('data-day-index') || '-1');
  const baseHour = parseInt(target.getAttribute('data-hour') || '-1');

  if (dayIndex === -1 || baseHour === -1) return null;

  // Verificar si el día es anterior a hoy
  const weekDays = this.getWeekDays();
  const selectedDate = weekDays[dayIndex].date;
  if (this.isDateBeforeToday(selectedDate)) {
    return null;
  }

  const timeColumnWidth = 60;
  const headerHeight = 80;
  
  const containerTop = rect.top + headerHeight;
  const containerBottom = rect.bottom;

  if (event.clientY < containerTop || event.clientY > containerBottom) {
    return null;
  }

  // Calcular la fracción de hora basada en la posición vertical dentro de la celda
  const cellRect = target.getBoundingClientRect();
  const relativeY = event.clientY - cellRect.top;
  const quarterHour = Math.floor((relativeY / this.hourHeight) * 4); // Dividir la hora en 4 partes
  
  // Ajustar la hora para incluir los cuartos de hora, restando 1 para alinear con la hora base
  const adjustedHour = (baseHour === 23) ? baseHour + (quarterHour / 4) : (baseHour - 1) + (quarterHour / 4);


  const x = event.clientX - rect.left - timeColumnWidth;
  const y = event.clientY - rect.top + calendarScrollTop + windowScrollY;
  const adjustedY = y - headerHeight;
  
  if (
    dayIndex >= 0 && 
    dayIndex < 7 && 
    adjustedHour >= this.BASE_HOUR && 
    adjustedHour < this.BASE_HOUR + 21 && 
    adjustedY >= 0
  ) {
    return { day: dayIndex, hour: adjustedHour };
  }

  return null;
}


//Metodo para crear el evento temporal
private createTemporaryEvent(event: MouseEvent) {
  if (this.isViewingOtherUserEvents()) return;

  if (!this.dragStartCell) return;

  this.temporaryEventElement = document.createElement('div');
  this.temporaryEventElement.className = 'temporary-event';
  document.body.appendChild(this.temporaryEventElement);
  this.updateTemporaryEvent();
}

//Metodo para actualizar el evento temporal
private updateTemporaryEvent() {
  if (!this.temporaryEventElement || !this.dragStartCell || !this.dragEndCell) return;

  const calendarGrid = document.querySelector('.calendar');
  if (!calendarGrid) return;

  const rect = calendarGrid.getBoundingClientRect();
  const calendarScrollTop = (calendarGrid as Element).scrollTop || 0;
  const windowScrollY = window.scrollY;
  const timeColumnWidth = 60;
  
  const day = this.dragStartCell.day;
  const startHour = Math.min(this.dragStartCell.hour, this.dragEndCell.hour);
  const endHour = Math.max(this.dragStartCell.hour, this.dragEndCell.hour);
  
  // Formatear las horas para mostrarlas
  const startTimeDisplay = this.formatTimeStringWithMinutes(Math.floor(startHour), Math.round((startHour % 1) * 60));
  const endTimeDisplay = this.formatTimeStringWithMinutes(Math.floor(endHour), Math.round((endHour % 1) * 60));
  
  const dayWidth = (rect.width - timeColumnWidth) / 7;
  
  const dayColumn = document.querySelector(`[data-day-index="${day}"]`);
  let left = rect.left + timeColumnWidth;
  
  if (dayColumn) {
    const dayRect = dayColumn.getBoundingClientRect();
    left = dayRect.left;
  } else {
    left = rect.left + timeColumnWidth + (day * Math.floor(dayWidth));
  }
  
  const headerHeight = 80;
  const topOffset = ((startHour - this.BASE_HOUR + 1) * this.hourHeight) + headerHeight - calendarScrollTop;
  const adjustedTop = rect.top + topOffset + windowScrollY;
  const height = (endHour - startHour) * this.hourHeight;

  const containerTop = rect.top + headerHeight;
  const containerBottom = rect.bottom;

  let finalTop = adjustedTop - windowScrollY;
  let finalHeight = height;

  if (finalTop < containerTop) {
    const difference = containerTop - finalTop;
    finalTop = containerTop;
    finalHeight -= difference;
  }

  if (finalTop + finalHeight > containerBottom) {
    finalHeight = containerBottom - finalTop;
  }

  if (finalHeight <= 0) {
    this.temporaryEventElement.style.display = 'none';
    return;
  }

  // Actualizar el contenido del evento temporal usando flexbox para el posicionamiento
  this.temporaryEventElement.innerHTML = `
    <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
      <div style="font-family: Arial, sans-serif; Lunasima font-size: 14px; font-weight: bold;">(title)</div>
      <div style="font-family: Arial, sans-serif; font-size: 14px;">${startTimeDisplay} - ${endTimeDisplay}</div>
    </div>
  `;

  Object.assign(this.temporaryEventElement.style, {
    position: 'fixed',
    left: `${left}px`,
    top: `${finalTop}px`,
    width: `${Math.floor(dayWidth)}px`,
    height: `${Math.max(0, finalHeight)}px`,
    backgroundColor: this.typeColors['perso'].backgroundColor,
    border: `8px solid ${this.typeColors['perso'].borderColor}`,
    margin: '0',
    padding: '4px',
    pointerEvents: 'none',
    zIndex: '1000',
    opacity: '0.7',
    boxSizing: 'border-box',
    overflow: 'hidden',
    display: 'block',
    color: '#000000'
  });
}

//Metodo auxiliar para el tiempo
private timeStringToMinutes(timeString: string): number {
  const [time, period] = timeString.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return hours * 60 + minutes;
}

//Metodo para limpiar el evento temporal cuando se cree o cancele
private cleanupDragCreate() {
  if (this.temporaryEventElement) {
    this.temporaryEventElement.remove();
    this.temporaryEventElement = null;
  }
  this.isDragCreating = false;
  this.dragStartCell = null;
  this.dragEndCell = null;
}
//Metodo para verificar las fechas.
private isDateBeforeToday(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

}
