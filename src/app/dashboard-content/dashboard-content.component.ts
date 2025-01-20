import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

interface CalendarEvent {
  id: string;
  name: string;
  type: string;
  date: Date;
  startTime: string;
  endTime: string;
  color: string;
}

interface WeekDay {
  date: Date;
  day: number;
  name: string;
  isToday: boolean;
}


@Component({
  selector: 'app-dashboard-content',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './dashboard-content.component.html',
  styleUrls: ['./dashboard-content.component.css']
})
export class DashboardContentComponent implements OnInit {

  private readonly BASE_HOUR = 3; // Hora base del calendario (3 AM)
  
  currentDate: Date;
  currentMonthName: string;
  currentYear: number;
  calendarDays: { day: number, isCurrentMonth: boolean, isHoliday: boolean }[][] = [];
  day: any;
  time: string = '';
endDay: string = '';

 // Variables para el horario del evento
  availableTimes: string[] = [];
  startTime: string = '';
  endTime: string = '';

  events: CalendarEvent[] = [];

  private typeColors: { [key: string]: { backgroundColor: string, borderColor: string } } = {
    'estrategica': { backgroundColor: '#EFD9D9', borderColor: '#EF0A06' },
    'administrativa': {  backgroundColor: '#D8EDD7', borderColor: '#0AD600' },
    'operativa': { backgroundColor: '#CADCF4', borderColor: '#086CF0' },
    'personal': { backgroundColor: '#E4E4E4', borderColor: '#747474' }
  };
  

  // Variables para el modal
  isCreateEventModalOpen: boolean = false;
  isModalOpen: boolean = false; // Controla la visibilidad del modal
 // Añade estas propiedades si no las tienes
selectedDate: Date | null = null;
selectedStartTime: string = '';
selectedEndTime: string = '';
 

   // Variable para los datos del formulario
   eventName: string = '';
   activityType: string = '';

  constructor(private cdr: ChangeDetectorRef) {
    this.currentDate = new Date();
    this.currentMonthName = this.getMonthName(this.currentDate.getMonth());
    this.currentYear = this.currentDate.getFullYear();
  }

  ngOnInit(): void {
    this.updateCalendar();
    this.generateAvailableTimes();
    
  }

  getMonthName(monthIndex: number): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[monthIndex];
  }

  changeMonth(direction: number): void {
    const newMonth = this.currentDate.getMonth() + direction;

    if (newMonth > 11) {
      this.currentDate.setFullYear(this.currentDate.getFullYear() + 1);
      this.currentDate.setMonth(0);
    } else if (newMonth < 0) {
      this.currentDate.setFullYear(this.currentDate.getFullYear() - 1);
      this.currentDate.setMonth(11);
    } else {
      this.currentDate.setMonth(newMonth);
    }

    this.currentMonthName = this.getMonthName(this.currentDate.getMonth());
    this.currentYear = this.currentDate.getFullYear();
    this.updateCalendar();
    this.cdr.detectChanges();
  }

  updateCalendar(): void {
    const daysInMonth = new Date(this.currentYear, this.currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(this.currentYear, this.currentDate.getMonth(), 1).getDay();
    const lastDayOfMonth = new Date(this.currentYear, this.currentDate.getMonth() + 1, 0).getDay();
  
    this.calendarDays = [];
    let week: { day: number, isCurrentMonth: boolean, isHoliday: boolean }[] = [];
  
    const holidays = this.getHolidaysForMonth(this.currentYear, this.currentDate.getMonth());
  
    // Rellenar los días del mes anterior si es necesario
    const prevMonthDays = new Date(this.currentYear, this.currentDate.getMonth(), 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      week.push({ day: prevMonthDays - i, isCurrentMonth: false, isHoliday: false });
    }
  
    // Agregar los días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
      const isHoliday = holidays.includes(day);
      week.push({ day, isCurrentMonth: true, isHoliday });
  
      if (week.length === 7) {
        this.calendarDays.push(week);
        week = [];
      }
    }
  
    // Rellenar los días del mes siguiente 
    const remainingDays = 7 - week.length;
    for (let i = 1; i <= remainingDays; i++) {
      week.push({ day: i, isCurrentMonth: false, isHoliday: false });
    }
  
    // Si hay días en la última semana, agregarla al calendario
    if (week.length > 0) {
      this.calendarDays.push(week);
    }
  }
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
  
    // Combinar festivos fijos y móviles del mes específico
    return [
      ...fixedHolidays.filter(h => h.month === month).map(h => h.day),
      ...mobileHolidays.filter(h => h.month === month).map(h => h.day)
    ];
  }
  
  calculateMobileHolidays(year: number): { month: number, day: number }[] {
    const holidays: { month: number, day: number }[] = [];
  
    // Calcular Domingo de Pascua
    const easter = this.calculateEasterSunday(year);
  
    // Jueves Santo y Viernes Santo
    const holyThursday = new Date(easter);
    holyThursday.setDate(easter.getDate() - 3);
    holidays.push({ month: holyThursday.getMonth(), day: holyThursday.getDate() });
  
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    holidays.push({ month: goodFriday.getMonth(), day: goodFriday.getDate() });
  
    // Corpus Christi
    const corpusChristi = new Date(easter);
    corpusChristi.setDate(easter.getDate() + 60);
    holidays.push({ month: corpusChristi.getMonth(), day: corpusChristi.getDate() });
  
    // Sagrado Corazón de Jesús
    const sacredHeart = new Date(easter);
    sacredHeart.setDate(easter.getDate() + 68);
    holidays.push({ month: sacredHeart.getMonth(), day: sacredHeart.getDate() });
  
    // Festivos con corrimientos al lunes
    holidays.push(...this.getMondayHolidays(year));
  
    return holidays;
  }
  
  getMondayHolidays(year: number): { month: number, day: number }[] {
    const holidays: { month: number, day: number }[] = [];
  
    // Día de los Reyes Magos (6 de enero trasladado al lunes)
    holidays.push(this.getFirstMondayAfter(year, 0, 6));
  
    // Día de San José (19 de marzo trasladado al lunes)
    holidays.push(this.getFirstMondayAfter(year, 2, 19));
  
    // San Pedro y San Pablo (29 de junio trasladado al lunes)
    holidays.push(this.getFirstMondayAfter(year, 5, 29));
  
    // Asunción de la Virgen (15 de agosto trasladado al lunes)
    holidays.push(this.getFirstMondayAfter(year, 7, 15));
  
    // Día de la Raza (12 de octubre trasladado al lunes)
    holidays.push(this.getFirstMondayAfter(year, 9, 12));
  
    // Día de Todos los Santos (1 de noviembre trasladado al lunes)
    holidays.push(this.getFirstMondayAfter(year, 10, 1));
  
    // Independencia de Cartagena (11 de noviembre trasladado al lunes)
    holidays.push(this.getFirstMondayAfter(year, 10, 11));
  
    return holidays;
  }
  
  getFirstMondayAfter(year: number, month: number, day: number): { month: number, day: number } {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
  
    // Si el día ya es lunes, no se traslada
    if (dayOfWeek === 1) {
      return { month: date.getMonth(), day: date.getDate() };
    }
  
    // Calcular la diferencia para llegar al próximo lunes
    const daysToAdd = (8 - dayOfWeek) % 7;
    date.setDate(date.getDate() + daysToAdd);
  
    return { month: date.getMonth(), day: date.getDate() };
  }
  
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
  
  
    // Método para abrir el modal
  openCreateEventModal(): void {
    this.isModalOpen = true;
  }

// Métodos para el modal
onModalBackgroundClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    this.closeModal();
  }
}

onModalContentClick(event: MouseEvent): void {
  event.stopPropagation();
}

closeModal(): void {
  this.isModalOpen = false;
  this.resetForm();
}

onDayClick(day: any) {
  if (day && day.isCurrentMonth) {
    this.openCreateEventModal();
  }
}


submitForm(): void {
  if (!this.eventName || !this.activityType || !this.selectedDate || !this.selectedStartTime || !this.selectedEndTime) {
    alert('Por favor, complete todos los campos.');
    return;
  }

  // Asegurarte de que la fecha del evento es correcta
  const newEvent: CalendarEvent = {
    id: Date.now().toString(),
    name: this.eventName,
    type: this.activityType,
    date: this.selectedDate,
    startTime: this.selectedStartTime,
    endTime: this.selectedEndTime,
    color: this.typeColors[this.activityType as keyof typeof this.typeColors].backgroundColor  
  };
  

  this.events.push(newEvent);
  console.log('Datos de la actividad:', newEvent);
  this.resetForm();
  this.closeModal();
  this.cdr.detectChanges();
}

getEventsForDay(weekDay: WeekDay): CalendarEvent[] {
  return this.events.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate.getDate() === weekDay.date.getDate() &&
           eventDate.getMonth() === weekDay.date.getMonth() &&
           eventDate.getFullYear() === weekDay.date.getFullYear();
  });
}


hasEventAtHour(weekDay: WeekDay, hour: number): CalendarEvent | null {
  const events = this.getEventsForDay(weekDay);
  return events.find(event => {
    const startHour = this.getHourFromTimeString(event.startTime);
    const endHour = this.getHourFromTimeString(event.endTime);
    return hour === startHour;
  }) || null;
}


private getHourFromTimeString(timeString: string): number {
  if (!timeString) return this.BASE_HOUR;
  
  const [time, period] = timeString.split(' ');
  let [hours] = time.split(':').map(Number);
  
  // Convertir a formato 24 horas
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours;
}

calculateEventHeight(event: CalendarEvent): number {
  const startHour = this.getHourFromTimeString(event.startTime);
  const endHour = this.getHourFromTimeString(event.endTime);
  return (endHour - startHour) * 80; // Usar el mismo factor de altura que getEventStyle
}

getEventStyle(event: CalendarEvent): any {
  const startHour = this.getHourFromTimeString(event.startTime);
  const endHour = this.getHourFromTimeString(event.endTime);
  const duration = endHour - startHour;
  
  const startPosition = (startHour - this.BASE_HOUR) + 80;
  const height = duration * 80;

  const eventColor = this.typeColors[event.type];

  return {
    height: `${height}px`,
    top: `${startPosition}px`,
    backgroundColor: eventColor.backgroundColor,
    borderLeft: `5px solid ${eventColor.borderColor}`,
    position: 'absolute',
    width: '95%',
    borderRadius: '4px',
    padding: '4px',
    color: eventColor.borderColor,  // Aquí asignamos el color del borde al texto
    zIndex: 1,
    overflow: 'hidden',
    cursor: 'pointer'
  };
}



 resetForm(): void {
  this.eventName = '';
  this.activityType = '';
  this.selectedDate = null;
  this.selectedStartTime = '';
  this.selectedEndTime = '';
}




  getWeekRange(): string {
    const startOfWeek = this.getStartOfWeek(this.currentDate);
    const endOfWeek = this.getEndOfWeek(this.currentDate);
    const startMonth = this.getMonthName(startOfWeek.getMonth());
    const endMonth = this.getMonthName(endOfWeek.getMonth());
    return `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${this.currentYear}`;
  }
  
  getStartOfWeek(date: Date): Date {
    const startOfWeek = new Date(date);
    const dayOfWeek = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajuste para que el lunes sea el primer día
    startOfWeek.setDate(diff);
    return startOfWeek;
  }
  
  getEndOfWeek(date: Date): Date {
    const startOfWeek = this.getStartOfWeek(date);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return endOfWeek;
  }

  changeWeek(direction: number): void {
    this.currentDate.setDate(this.currentDate.getDate() + direction * 7);
    this.updateCalendar();
    this.cdr.detectChanges();
  }
  
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


generateAvailableTimes(): void {
  const times: string[] = [];
  
  // Generar horas desde BASE_HOUR (3 AM) hasta 12 AM del día siguiente
  for (let hour = this.BASE_HOUR; hour < this.BASE_HOUR + 21; hour++) {
    const adjustedHour = hour % 24; // Asegura que las horas estén en el rango 0-23
    const isPM = adjustedHour >= 12;
    const displayHour = adjustedHour > 12 ? adjustedHour - 12 : (adjustedHour === 0 ? 12 : adjustedHour);
    times.push(`${displayHour.toString().padStart(2, '0')}:00 ${isPM ? 'PM' : 'AM'}`);
  }
  
  this.availableTimes = times;
}






onDateClick(event: Event): void {
  const inputElement = event.target as HTMLInputElement;
  const selectedValue = inputElement.value;
  const selectedDate = new Date(selectedValue);
  this.selectedDate = selectedDate;
  this.day = this.formatDate(selectedDate);
}




// Métodos actualizados
onDateChange(event: any): void {
  const selectedValue = event.target.value;
  const [year, month, day] = selectedValue.split('-').map(Number);
  this.selectedDate = new Date(year, month - 1, day); // Removemos UTC
  this.day = selectedValue;
}




onStartTimeChange(value: string): void {
  this.selectedStartTime = value;
  this.time = value;
}

onEndTimeChange(value: string): void {
  this.selectedEndTime = value;
  this.endDay = value;
}

private formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

}