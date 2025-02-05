import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { HttpClient } from '@angular/common/http';


/**INTERFASES GENERALES, UTILES A LO LARGO DEL CODIGO */
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

interface ActivityStats {
  estrategica: number;
  administrativa: number;
  operativa: number;
  personal: number;
}




@Component({
  selector: 'app-dashboard-content',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './dashboard-content.component.html',
  styleUrls: ['./dashboard-content.component.css']
})
export class DashboardContentComponent implements OnInit {

  /**PROPIEDADES Y LOGICA PARA EL MANEJO DE FUNCIONALIDADES DEL CALENDARIO SEMANAL */

  private readonly BASE_HOUR = 3; /**HORA BASE DEL CALENDARIO */
  
  /**PROPIEDADES DE ARRASTRE (drag) */
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

/**PROPIEDADES PARA CREACION DE EVENTOS MEDIANTE ARRASTRE */
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

 /**VARIABLES PARA LOS HORARIOS DEL EVENTO */
  availableTimes: string[] = [];
  startTime: string = '';
  endTime: string = '';

  /**REDIMENSION DE EVENTOS */
  isResizing: boolean = false;
  resizeStartY: number = 0;
  resizeStartTime: string = '';
  resizingEvent: CalendarEvent | null = null;
  resizeType: 'top' | 'bottom' | null = null;
  

  events: CalendarEvent[] = [];

  /* ASGINACIÓN AUTOMATICA DE ESTILOS VISUALES PARA EL TIPO DE EVENTO*/
  private typeColors: { [key: string]: { backgroundColor: string, borderColor: string } } = {
    'estrategica': { backgroundColor: '#EFD9D9', borderColor: '#EF0A06' },
    'administrativa': { backgroundColor: '#D8EDD7', borderColor: '#0AD600' },
    'operativa': { backgroundColor: '#CADCF4', borderColor: '#086CF0' },
    'personal': { backgroundColor: '#E4E4E4', borderColor: '#747474' },
    'perso': { backgroundColor: '#E9F5FA', borderColor: '#000000' } 
  };
  
  

/**VARIABLES PARA EL MODAL, NECESARIAS PARA CONTROLARLO */
  isCreateEventModalOpen: boolean = false;
  isModalOpen: boolean = false; /**CONTROLA VISIBILIDAD DEL MODAL */
  selectedDate: Date | null = null;
  selectedStartTime: string = '';
  selectedEndTime: string = '';
  private originalEventDuration: number = 0;

 /**VARIABLES PARA LOS PORCENTAJES DEL EVENTO (CONTENEDOR ACTIVITIES) */
   activityPercentages: ActivityStats = {
    estrategica: 0,
    administrativa: 0,
    operativa: 0,
    personal: 0
  };
 

  /**VARIABLES PARA LOS DATOS DEL MODAL PARA CREAR EVENTOS */
   eventName: string = '';
   activityType: string = '';

   /*CONSTRUCTOR PARA DETECTAR Y GESTIONAR LOS CAMBIOS MANUALES DEL COMPONENTE */
   constructor(private cdr: ChangeDetectorRef, private http: HttpClient) {
    this.currentDate = new Date();
    this.currentMonthName = this.getMonthName(this.currentDate.getMonth());
    this.currentYear = this.currentDate.getFullYear();
  }
  

  /*CICLO DE VIDA */
  ngOnInit(): void {
    this.updateCalendar(); /**METODO PARA ACTUALIZAR EL CALENDARIO EN LA INTERFAZ */
    this.generateAvailableTimes(); /**GENERA LOS HORARIOS DISPONIBLES */
  }

  /**DEVUELVE EL OMBRE DEL MES CORRESPONDIENTE A UN INDICE, POR EJEMPLO 0 PARA ENERO, 1 PARA FEBRERO, ETC... */
  getMonthName(monthIndex: number): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[monthIndex];
  }

  /**PARA CAMBIAR EL MES DEL CALENDARIO (FLECHAS) EN LA DIRECCION ESPECIFICADA, PARA AVANZAR +1, PARA RETROCEDER -1 */
  changeMonth(direction: number): void {
    const newMonth = this.currentDate.getMonth() + direction;

    if (newMonth > 11) {
      this.currentDate.setFullYear(this.currentDate.getFullYear() + 1); /**AVANZAR (FLECHA APUNTANDO A LA DERECHA) */
      this.currentDate.setMonth(0);
    } else if (newMonth < 0) {
      this.currentDate.setFullYear(this.currentDate.getFullYear() - 1); /**RETROCEDER (FLECHA APUNTANDO A LA IZQUIERDA) */
      this.currentDate.setMonth(11);
    } else {
      this.currentDate.setMonth(newMonth);
    }

    this.currentMonthName = this.getMonthName(this.currentDate.getMonth());
    this.currentYear = this.currentDate.getFullYear();
    this.updateCalendar(); /*ACTUALIZAR CALENDARIO*/

    this.cdr.detectChanges(); /**DETECCION DE CAMBIOS */
  }

  /**ACTUALIZAR CALENDARIO */
  updateCalendar(): void {
    /**OBTENCIÓN DE DATOS DEL MES ACTUAL */
    const daysInMonth = new Date(this.currentYear, this.currentDate.getMonth() + 1, 0).getDate(); /**CANTIDAD TOTAL DE DÍAS DEL MES ACTUAL */
    const firstDayOfMonth = new Date(this.currentYear, this.currentDate.getMonth(), 1).getDay(); /**DEVUELVE EL DÍA DE LA SEMANA DEL PRIMER DÍA DEL MES (0 PARA DOMINGO, 6 PARA SABADO) */
    const lastDayOfMonth = new Date(this.currentYear, this.currentDate.getMonth() + 1, 0).getDay(); /**DEVUELVE EL DÍA DE LA SEMANA DEL ULTIMO DÍA DEL MES */
  
    /**INICIALIZAR */
    this.calendarDays = [];  /**ALMACENA TODAS LAS SEMANAS DEL MES */
    let week: { day: number, isCurrentMonth: boolean, isHoliday: boolean }[] = []; /**ARRAY TEMPORAL PARA ALMACENAR CADA SEMANA ANDES DE AÑADIRLA A CALENDARDAYS */
  
    const holidays = this.getHolidaysForMonth(this.currentYear, this.currentDate.getMonth()); /**LISTA DE DIAS FERSTIVOS DEL MES ACTUAL, OBTENIDA MEDIANTE getHolidaysForMonto() */
  
    /**RELLENAR DIÁS DEL MES ANTERIOR SI ES NECESARIO */
    const prevMonthDays = new Date(this.currentYear, this.currentDate.getMonth(), 0).getDate(); /**CALCULA NUMERO TOTAL DE DIÁS DEL MES ANTERIOR */
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      week.push({ day: prevMonthDays - i, isCurrentMonth: false, isHoliday: false });
    } 
  
 /**RELLENO DÍAS DEL MES ACTUAL */
    for (let day = 1; day <= daysInMonth; day++) {
      const isHoliday = holidays.includes(day);
      week.push({ day, isCurrentMonth: true, isHoliday });
  
      if (week.length === 7) {
        this.calendarDays.push(week);
        week = [];
      }
    }
  
  /**RELLENO DÍAS MES SIGUIENTE */
    const remainingDays = 7 - week.length;
    for (let i = 1; i <= remainingDays; i++) {
      week.push({ day: i, isCurrentMonth: false, isHoliday: false });
    }
  
  /**AGREGAR ÚLTIMA SEMANA DEL MES */
    if (week.length > 0) {
      this.calendarDays.push(week);
    }
  }

  /**METODO PARA LOS DIAS FESTIVOS  (Monthly-calendar)*/
  getHolidaysForMonth(year: number, month: number): number[] {
    const fixedHolidays = [
      { month: 0, day: 1 }, /**AÑO NUEVO */
      { month: 4, day: 1 }, /**DIA DEL TRABAJO */
      { month: 6, day: 20 }, /**DIA DE LA INDEPENDENCIA */
      { month: 7, day: 7 }, /**BATALLA DE BOYACA */
      { month: 11, day: 8 }, /**INMACULADA CONCEPCIÓN */
      { month: 11, day: 25 } /**NAVIDAD */
    ];
  
    const mobileHolidays = this.calculateMobileHolidays(year);
  
  /**COMBINAR FESTIVOS MOVILES Y FIJOS */
    return [
      ...fixedHolidays.filter(h => h.month === month).map(h => h.day),
      ...mobileHolidays.filter(h => h.month === month).map(h => h.day)
    ];
  }
  
  /**DIAS FESTIVOS MOBILES */
  calculateMobileHolidays(year: number): { month: number, day: number }[] {
    const holidays: { month: number, day: number }[] = [];
  
    /**CALCULO DOMINGO DE PASCUA */
    const easter = this.calculateEasterSunday(year);
  
   /**JUEVES Y VIERNES SANTOS */
    const holyThursday = new Date(easter);
    holyThursday.setDate(easter.getDate() - 3);
    holidays.push({ month: holyThursday.getMonth(), day: holyThursday.getDate() });
  
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    holidays.push({ month: goodFriday.getMonth(), day: goodFriday.getDate() });
  
    /**CORPUS CRISTI */
    const corpusChristi = new Date(easter);
    corpusChristi.setDate(easter.getDate() + 60);
    holidays.push({ month: corpusChristi.getMonth(), day: corpusChristi.getDate() });
  
   /**SAGRADO CORAZÓN DE JESÚS */
    const sacredHeart = new Date(easter);
    sacredHeart.setDate(easter.getDate() + 68);
    holidays.push({ month: sacredHeart.getMonth(), day: sacredHeart.getDate() });
  
    /**FESTIVOS EN CORRIMIENTO PARA EL LUNES */
    holidays.push(...this.getMondayHolidays(year));
  
    return holidays;
  }
  
  /**CALCULOS PARA LOS DÍAS LUNES FESTIVOS */
  getMondayHolidays(year: number): { month: number, day: number }[] {
    const holidays: { month: number, day: number }[] = [];
  
    /**REYES MAGOS */
    holidays.push(this.getFirstMondayAfter(year, 0, 6));
 
    /**SAN JOSE */
    holidays.push(this.getFirstMondayAfter(year, 2, 19));
  
 /**SAN PEDRO Y SAN PABLO */
    holidays.push(this.getFirstMondayAfter(year, 5, 29));
  
  /**ASUNCIÓN DE LA VIRGEN */
    holidays.push(this.getFirstMondayAfter(year, 7, 15));
  
    /**DIA DE LA RAZA */
    holidays.push(this.getFirstMondayAfter(year, 9, 12));
  
  /**DIA DE TODOS LOS SANTOS */
    holidays.push(this.getFirstMondayAfter(year, 10, 1));
  
/**INDEPENDENCIA DE CARTAGENA */
    holidays.push(this.getFirstMondayAfter(year, 10, 11));
  
    return holidays;
  }
  
  /**FUNCION PARA ENCONTRAR EL LUNES LUEGO DE UNA FECHA ESPECIFICA */
  getFirstMondayAfter(year: number, month: number, day: number): { month: number, day: number } {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
  
    /**SI EL DIA YA ES LUNES, NO SE TRASLADA */
    if (dayOfWeek === 1) {
      return { month: date.getMonth(), day: date.getDate() };
    }
  
/**CALCULO PARA LA LLEGADA DEL PRÓXIMO LUNES */
    const daysToAdd = (8 - dayOfWeek) % 7;
    date.setDate(date.getDate() + daysToAdd);
  
    return { month: date.getMonth(), day: date.getDate() };
  }
  
  /**CALCULO PARA LA LLEGADA DEL DOMINGO DE PASCUA */
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
  
  
/**METODO PARA ABRIR EL MODAL DE EVENTO */
 openCreateEventModal(): void {
/**RESETEA LOS CAMPOS LUEGO DE CERRARLO */
  this.eventName = '';
  this.activityType = '';
  
 /**ESTO SOLO RESETEA LAS HORAS SI NO VIENEN DEL DRAG */
  if (!this.isDragCreating) {
    this.selectedStartTime = '';
    this.selectedEndTime = '';
    this.time = '';
    this.endDay = '';
  }
  
  this.isModalOpen = true;
}

/**METODO PARA CERRAR EL MODAL */
closeModal(): void {
  this.isModalOpen = false;
  if (!this.isDragCreating) {
    this.resetForm();
  }
  this.isDragCreating = false; /**RESET DEL FLAG DEL GRAD */
}

/**CIERRA EL MODAL AL HACER CLICK FUERA DE ÉL */
onModalBackgroundClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) { 
    this.closeModal();
  } /**VERIFICACIÓN DEL CLICK */
}

/**METODO PARA EVITAR PROPAGACIÓN DEL MODAL HACIA EL FONDO DEL CONTENIDO, ESTO EVITA EL CIERRRE INVOLUNTARIO DEL MODAL */
onModalContentClick(event: MouseEvent): void {
  event.stopPropagation();
}

/**MANEJA EL CLICK DEL MONTHLY-CALENDAR, ESTO ABRE EL MODAL CON LA FECHA SELECCIONADA AUTOMATICAMENTE */
onDayClick(day: any) {
  if (day && day.isCurrentMonth) {
    /**CREACION DE FECHA PARA EL DÍA SELECCIONADO */
    const selectedDate = new Date(this.currentYear, this.currentDate.getMonth(), day.day);
    
    /**ESTABLECER FECHA DEL DÍA SELECCIONADO */
    this.selectedDate = selectedDate;
    
    /**FORMATEO DE FECHA EN EL INPUT DEL MODAL */
    this.day = this.formatDate(selectedDate);
    
    /**ABRIR MODAL */
    this.openCreateEventModal();
  }
}

/**PROCESAMIENTO Y CREEACION DE UN EVENTO EN EL CALENDARIO */
submitForm(): void {
  /**VALIDACION DE CAMPOS VACIOS */
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

  /**CONVIERTE TIEMPO A MINUTOS EN LA NOCHE */
  const getMinutesFromMidnight = (timeString: string) => {
    const [time, period] = timeString.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return hours * 60 + minutes;
  };

  const startMinutes = getMinutesFromMidnight(this.selectedStartTime);
  const endMinutes = getMinutesFromMidnight(this.selectedEndTime);

  /**VERIFICAR QUE LA HORA DE FIN SEA POSTERIOR A LA HORA DE INICIO */
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

 /**OBJETO TEMPORAL PARA VERIFICACION */
  const newEvent: Partial<CalendarEvent> = {
    date: this.selectedDate,
    startTime: this.selectedStartTime,
    endTime: this.selectedEndTime
  };

  /**VERIFICACION PARA LA COLISION DE HORARIOS */
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

 /**CREAR EL EVENTO SI NO HAY COLISION */
  const finalEvent: CalendarEvent = {
    id: Date.now().toString(),
    name: this.eventName,
    type: this.activityType,
    date: this.selectedDate,
    startTime: this.selectedStartTime,
    endTime: this.selectedEndTime,
    color: this.typeColors[this.activityType as keyof typeof this.typeColors].backgroundColor
  };

/**EVENTO AL SERVIDOR */
 this.http.post('/api/events', finalEvent).subscribe({ /**LLAMAR AL METODO DESDE LA API */
  next: () => {
    this.events.push(finalEvent); /**ENVIAR EVENTO */
    this.calculateActivityPercentages(); /**CALCULO DE PORCENTAJES */
    
    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'success',
      title: 'El evento se registró exitosamente.',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
    
    this.closeModal(); /**CERRAR MODAL AL HACER ENVIO */
    this.cdr.detectChanges(); /**FORZAR DETECCION DE CAMBIOS */
  },
  error: (error) => { /**VALIDACION DE ERRORES */
    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'error',
      title: 'Error al guardar el evento',
      text: error.message,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  }
});
}

/**RESETEA LOS CAMPOS DEL FORMULARIO A SUS VALORES INICIALES */
resetForm(): void { /**RESETEA LOS CAMPOS LUEGO DE USAR EL MODAL, ESTO PARA EVITAR CONGESTIONES O BUGS */
  this.eventName = ''; 
  this.activityType = '';
  this.selectedDate = null;
  this.selectedStartTime = '';
  this.selectedEndTime = '';
  this.time = '';
  this.endDay = '';
  this.day = '';
}

/**GESTION PARA EL REDIMENCIONAMIENTO DE EVENTOS */
startResize(event: MouseEvent, calendarEvent: CalendarEvent, type: 'top' | 'bottom') {
  event.preventDefault(); /**PREVENIR COMPORTAMIENTO POR DEFECTO DEL MOUSE */
  event.stopPropagation(); /**DETENER PROPAGACIÓN */
  
  this.isResizing = true; /**MARCA QUE LA REDIMENCION ESTA ACTIVA */
  this.resizingEvent = { ...calendarEvent }; /**COPIA DEL EVENTO QUE REDIMENCIONA, EVITA ALTERAR EL EVENTO ORIGINAL */
  this.resizeStartY = event.clientY; /**GUARDA LA POSICION VERTICAL DEL MOUSE, QUE SE USA PARA CALCULAR EL TAMAÑO MAS ADELANTE */
  this.resizeType = type; /**DEFINE LA PARTE DEL EVENTO QUE SE REDIMENCIONA */
  this.resizeStartTime = type === 'top' ? calendarEvent.startTime : calendarEvent.endTime; /**GUARDA LA HORA CORRESPONDIENTE */
  
  document.body.style.cursor = 'ns-resize'; /**CURSOR */
}

/**GESTION DE COMPORTAMIENTO PARA LA REDIMENSION DE EVENTOS DENTRO DEL CALENDARIO */
@HostListener('document:mousemove', ['$event'])
onMouseMove(event: MouseEvent) {
  /**COMPRUEBA SI ESTA ACTIVO EL PROCESO DE REDIMENSION */
  if (this.isResizing && this.resizingEvent) {
    event.preventDefault(); /**PREVIENE ACCION PREDETERMINADA AL MOVER EL MOUSE */
    
    /**CALCULO DEL DESPLAZAMIENTO DEL RATÓN */
    const deltaY = event.clientY - this.resizeStartY; /**CAMBIO DE POSICIÓN VERTICAL */
    const quarterHourHeight = this.hourHeight / 4; /**CALCULA EL INTERVALO DE 15 MIN */
    const quarterHourDelta = Math.round(deltaY / quarterHourHeight); 
    
    /**CONVERTIR HORA EN FORMATO DE CADENA A MINUTOS A PARTIR DE MEDIA NOCHE */
    const getMinutesFromTime = (timeString: string): number => {
      const [time, period] = timeString.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      else if (period === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };
    
    /**FORMATEA UN NUMERO TOTAL DE MINUTOS EN UNA CADENA DE HORA ESTANDAR */
    const formatTimeWithMinutes = (totalMinutes: number): string => {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const isPM = hours >= 12;
      const displayHours = hours % 12 || 12;
      return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
    };
    
  /**OBTENER MINUTOS ORIGINALES DEL EVENTO ACTUAL */
    const currentStartMinutes = getMinutesFromTime(this.resizingEvent.startTime);
    const currentEndMinutes = getMinutesFromTime(this.resizingEvent.endTime);
    
/**CALCULO DE NUEVOS TIEMPOS SEGÚN REDIMENCIONAMIENTO */
    let newStartMinutes = currentStartMinutes;
    let newEndMinutes = currentEndMinutes;
    
    if (this.resizeType === 'top') {
      newStartMinutes = currentStartMinutes + (quarterHourDelta * 15);
    /**LIMITACIÓN PARA EL TIEMPO DE INICIO */
      newStartMinutes = Math.max(
        this.BASE_HOUR * 60,
        Math.min(currentEndMinutes - 15, newStartMinutes)
      );
    } else {
      newEndMinutes = currentEndMinutes + (quarterHourDelta * 15);
      /**LIMITAR TIEMPO DE FINALIZACIÓN */
      newEndMinutes = Math.max(
        currentStartMinutes + 15,
        Math.min((this.BASE_HOUR + 21) * 60, newEndMinutes)
      );
    }
    
    /**AJUSTAR A INTERVALOS DE 15 MINUTOS */
    newStartMinutes = Math.round(newStartMinutes / 15) * 15;
    newEndMinutes = Math.round(newEndMinutes / 15) * 15;
    /**AJUSTE DE NUEVOS MINUTOS */
    const tempEvent = {
      ...this.resizingEvent,
      startTime: formatTimeWithMinutes(newStartMinutes),
      endTime: formatTimeWithMinutes(newEndMinutes)
    };
    
   /**VERIFICAR COLISIONES, EXCLUYENDO EVENTO ACTUAL */
    const hasCollision = this.events
      .filter(e => e.id !== this.resizingEvent?.id) /**EXCLUIR EVENTO ACTUAL */
      .filter(e => e.date.toDateString() === this.resizingEvent?.date.toDateString()) /**SOLO EVENTOS DEL MISMO DÍA */
      .some(existingEvent => {
        const existingStart = getMinutesFromTime(existingEvent.startTime);
        const existingEnd = getMinutesFromTime(existingEvent.endTime);
        
        return (
          (newStartMinutes >= existingStart && newStartMinutes < existingEnd) ||
          (newEndMinutes > existingStart && newEndMinutes <= existingEnd) ||
          (newStartMinutes <= existingStart && newEndMinutes >= existingEnd)
        );
      });
    
      if (!hasCollision) {
        const eventIndex = this.events.findIndex(e => e.id === this.resizingEvent?.id);
        if (eventIndex !== -1) {
          const updatedEvent = {
            ...this.events[eventIndex],
            startTime: formatTimeWithMinutes(newStartMinutes),
            endTime: formatTimeWithMinutes(newEndMinutes)
          };
  
          /**SEGUN EL REDIMENCIONAMIENTO DEL EVENTO, ACTUALIZARLO EN LA BASE DE DATOS */
          this.http.put(`/api/events/${updatedEvent.id}`, updatedEvent).subscribe({ /**LLAMAR AL METODO */
            next: () => {
              this.events[eventIndex] = updatedEvent; /**ACTUALIZAR */
              this.calculateActivityPercentages(); /**NUEVO CALCULO DE PORCENTAJES */
              this.cdr.detectChanges(); 
            },
            error: (error) => { /**VALIDACION SOBRE ERRORES */
              Swal.fire({
                toast: true,
                position: 'top',
                icon: 'error',
                title: 'Error al actualizar el evento',
                text: error.message,
                showConfirmButton: false,
                timer: 3000
              });
              /**REVERTIR LOS CAMBIOS SI LLEGA A FALLAR LA ACTUALIZACIÓN */
              this.cdr.detectChanges();
            }
          });
        }
      }
    
    

    /**NECESARIO PARA EL ARRASTRE DE EVENTOS PARA EL DÍA/HORA */

    /* } else if (this.isDragging && this.draggedEvent && this.dragStartHour !== null) {
    event.preventDefault();
    
    const mouseY = event.clientY;
    const mouseX = event.clientX;
    const deltaY = mouseY - this.dragStartY;
    const deltaX = mouseX - this.dragStartX;
    
    // Calcular nueva hora manteniendo los minutos originales
    const hourDelta = Math.round(deltaY / this.hourHeight);
    let newStartHour = this.dragStartHour + hourDelta;
    newStartHour = Math.max(this.BASE_HOUR, Math.min(this.BASE_HOUR + 20, newStartHour));

    const dayDelta = Math.round(deltaX / this.dayWidth);
    const weekDays = this.getWeekDays();
    const newDayIndex = Math.max(0, Math.min(6, this.originalDayIndex + dayDelta));
    const newDate = weekDays[newDayIndex].date;
    
    // Mantener los minutos originales
    const [startMinutes, endMinutes] = this.getEventMinutes(this.draggedEvent);
    
    // Formatear las horas manteniendo los minutos y la duración original
    const formatTimeWithMinutes = (hour: number, minutes: number): string => {
      const adjustedHour = hour % 24;
      const isPM = adjustedHour >= 12;
      const displayHour = adjustedHour > 12 ? adjustedHour - 12 : (adjustedHour === 0 ? 12 : adjustedHour);
      return `${displayHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
    };

    // Crear evento temporal para verificar colisión
    const tempEvent = {
      ...this.draggedEvent,
      date: newDate,
      startTime: formatTimeWithMinutes(newStartHour, startMinutes),
      endTime: formatTimeWithMinutes(newStartHour + this.originalEventDuration, endMinutes)
    };
    
    this.validDropZone = !this.checkTimeCollision(tempEvent);
    
    // Actualizar estilos del evento que se está arrastrando
    const eventElement = document.querySelector('.event-dragging');
    if (eventElement) {
      if (this.validDropZone) {
        eventElement.classList.add('valid-drop');
        eventElement.classList.remove('invalid-drop');
      } else {
        eventElement.classList.add('invalid-drop');
        eventElement.classList.remove('valid-drop');
      }
    } */


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

/**METODO AUXILIAR PARA OBTNENER LOS MINUTOS DEL INICIO Y FIN */
private getEventMinutes(event: CalendarEvent): [number, number] {
  const getMinutes = (timeString: string): number => {
    return parseInt(timeString.split(':')[1].split(' ')[0]);
  };
  
  return [ /**RETORNAR MINUTOS DE INICIO Y FIN */
    getMinutes(event.startTime),
    getMinutes(event.endTime)
  ];
}

/**FINALIZACION DE ACCIONES DE REDIMENCIONAMIENTO/ARRASTRE DE EVENTOS */
@HostListener('document:mouseup', ['$event'])
onMouseUp(event: MouseEvent) {
  /**DESACTIVACION DE LA REDIMENCION */
  if (this.isResizing) {
    this.isResizing = false;
    this.resizingEvent = null;
    this.resizeType = null;
    document.body.style.cursor = 'default'; 

    /**NECESARIO PARA EL ARRASTRE DE HORA/DIA */

/* } else if (this.isDragging && this.draggedEvent && this.dragStartHour !== null) {
    const mouseY = event.clientY;
    const mouseX = event.clientX;
    const deltaY = mouseY - this.dragStartY;
    const deltaX = mouseX - this.dragStartX;
    
    // Obtener los minutos originales y la duración exacta
    const getMinutesFromTime = (timeString: string): { hours: number, minutes: number } => {
      const [time, period] = timeString.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      
      if (period === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }
      
      return { hours, minutes };
    };
    
    const startTime = getMinutesFromTime(this.draggedEvent.startTime);
    const endTime = getMinutesFromTime(this.draggedEvent.endTime);
    
    // Calcular la duración exacta en minutos
    const durationMinutes = 
      ((endTime.hours * 60 + endTime.minutes) - 
       (startTime.hours * 60 + startTime.minutes));
    
    // Calcular nueva hora manteniendo los minutos originales
    const hourDelta = Math.round(deltaY / this.hourHeight);
    let newStartHour = (this.dragStartHour - 1) + hourDelta;
    newStartHour = Math.max(this.BASE_HOUR, Math.min(this.BASE_HOUR + 20, newStartHour));
    
    const dayDelta = Math.round(deltaX / this.dayWidth);
    const weekDays = this.getWeekDays();
    const newDayIndex = Math.max(0, Math.min(6, this.originalDayIndex + dayDelta));
    const newDate = weekDays[newDayIndex].date;
    
    // Función para formatear tiempo preservando minutos exactos
    const formatTimeWithExactMinutes = (hours: number, minutes: number): string => {
      const adjustedHour = hours % 24;
      const isPM = adjustedHour >= 12;
      const displayHour = adjustedHour > 12 ? adjustedHour - 12 : (adjustedHour === 0 ? 12 : adjustedHour);
      return `${displayHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
    };
    
    // Calcular tiempo de finalización basado en la duración original
    const newStartTotalMinutes = newStartHour * 60 + startTime.minutes;
    const newEndTotalMinutes = newStartTotalMinutes + durationMinutes;
    
    const newStartTime = formatTimeWithExactMinutes(
      Math.floor(newStartTotalMinutes / 60),
      newStartTotalMinutes % 60
    );
    const newEndTime = formatTimeWithExactMinutes(
      Math.floor(newEndTotalMinutes / 60),
      newEndTotalMinutes % 60
    );
    
    const eventIndex = this.events.findIndex(e => e.id === this.draggedEvent!.id);
    if (eventIndex !== -1 && this.validDropZone) {
      this.events[eventIndex] = {
        ...this.events[eventIndex],
        date: newDate,
        startTime: newStartTime,
        endTime: newEndTime
      };
      
      this.calculateActivityPercentages();
    }
    
    this.finalizeDragDrop(); */

 
  } else if (this.isDragCreating && this.dragStartCell && this.dragEndCell) {
    const weekDays = this.getWeekDays();
    const selectedDate = weekDays[this.dragStartCell.day].date;
    
    const startHour = Math.min(this.dragStartCell.hour, this.dragEndCell.hour) - 1;
    const endHour = Math.max(this.dragStartCell.hour, this.dragEndCell.hour);
    
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
/**FINALIZA EL PROCESO DE ARRASTRAR Y SOLTAR (INACTIVO) SELECCIONA LOS ELEMENTOS DE LAS CLASES EVENT-DRAGGING-VALID DROP DONDE SE PUEDE O NO SOLTAR EL EVENTO, LUEGO LAS ELIMINA REESTABLECIENDO LOS ESTILOS VISUALES */
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

/**METODO AUXILIAR PARA FORMATEAR LA HORA */
private formatTimeString(hour: number): string {
  const adjustedHour = hour % 24;
  const isPM = adjustedHour >= 12;
  const displayHour = adjustedHour > 12 ? adjustedHour - 12 : (adjustedHour === 0 ? 12 : adjustedHour);
  return `${displayHour.toString().padStart(2, '0')}:00 ${isPM ? 'PM' : 'AM'}`;
}

/**INICIALIZAR PROCESO DE ARRASTRE DE UN EVENTO */
 startDragEvent(event: MouseEvent, calendarEvent: CalendarEvent) {
  /**PREVENCION DEL COMPORTAMIENTO POR DEFECTO */
  event.preventDefault();
  this.isDragging = true; /**INDICA QUE EL EVENTO ESTA SIENDO ARRASTRADO */
  this.draggedEvent = { ...calendarEvent }; /**GUARDA UNA COPIA DEL CalendarEvent o draggedEvent, PERMITE QUE EL ESTADO DEL EVENTO SE MODIFIQUE */
  
/**ALMACENAMIENTO DE POSICIONES INICIALES */

  /**ALMACENAMIENTO DE CORDENADAS DEL PUNTERO DEL RATON AL MOMENTO QUE EMPIEZA EL ARRASTRE */
  this.dragStartX = event.clientX;
  this.dragStartY = event.clientY;

  /**ALMACENA LA HORA DE INICIO DEL EVENTO EN FORMATO DE HORA */
  this.dragStartHour = this.timeStringToHour(calendarEvent.startTime);

  /**CALCULAR Y ALMACENAR DURACIÓN DEL EVENTO */
  const startMinutes = this.timeStringToMinutes(calendarEvent.startTime); /**CALCULO DE MINUTOS DE INICIO */
  const endMinutes = this.timeStringToMinutes(calendarEvent.endTime); /**CALCULO DE MINUTOS DE FIN */
  this.originalEventDuration = (endMinutes - startMinutes) / 60; /**DURACION EN HORAS */

/**CALCULAR INDICE DEL DÍA ORIGINAL */
  const weekDays = this.getWeekDays(); /**OBTENCION DEL INDICE */
  const eventDate = new Date(calendarEvent.date);
  this.originalDayIndex = weekDays.findIndex(day => 
    day.date.toDateString() === eventDate.toDateString()
  );

/**CALCULAR ANCHO DEL DÍA */
  const calendarElement = document.querySelector('.calendar');
  if (calendarElement) {
    this.dayWidth = calendarElement.getBoundingClientRect().width / 7;
  }

/**CLASE DE ARRASTRE */
  const eventElement = event.target as HTMLElement;
  eventElement.classList.add('event-dragging');
} 

/**CALCULA EL DÍA DE LA SEMANA EN EL QUE SE ENCUENTRA EL MOUSE */
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

/**ACTUALIZA LA FECHA DEL EVENTO ESPECIFICADO CON LA NUEVA FECHA */
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


/**FILTRAR Y DEVOLVER TODOS LOS EVENTOS QUE CORRESPONDEN A UN DÍA ESPECIFICO */
getEventsForDay(weekDay: WeekDay): CalendarEvent[] {
  return this.events.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate.getDate() === weekDay.date.getDate() &&
           eventDate.getMonth() === weekDay.date.getMonth() &&
           eventDate.getFullYear() === weekDay.date.getFullYear();
  });
}

/**VERIFICA SI EXISTE ALGUN EVENTO EN UN DIA ESPECIFICO A UNA HORA DETERMINADA */
hasEventAtHour(weekDay: WeekDay, hour: number): CalendarEvent | null {
  const events = this.getEventsForDay(weekDay);
  return events.find(event => {
    const startHour = this.getHourFromTimeString(event.startTime);
    const endHour = this.getHourFromTimeString(event.endTime);
    return hour === startHour;
  }) || null;
}

/**CONVIERTE UN STRING DE HORA EN FORMATO DE 12 HORAS A FORMATO DE 24 HORAS, DEVOLVIENDO LA HORA QUE CORRESPONDE EN FORMATO DE 24 HORAS */
private getHourFromTimeString(timeString: string): number {
  if (!timeString) return this.BASE_HOUR;
  
  const [time, period] = timeString.split(' ');
  let [hours] = time.split(':').map(Number);
  
 /**CONVERTIR A FORMATO DE 24 HORAS */
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

getEventStyle(event: CalendarEvent): any {
  const startHour = this.getHourFromTimeString(event.startTime);
  const endHour = this.getHourFromTimeString(event.endTime);
  
  /**EXTRACCIÓN DE HORAS DE INICIO Y FIN */
  const [startMinutes, endMinutes] = [
    parseInt(event.startTime.split(':')[1].split(' ')[0]),
    parseInt(event.endTime.split(':')[1].split(' ')[0])
  ];

/**CALCULAR DESPLAZAMIENTO VERTICAL Y ALTURA PROPORCIONALMENTE */
  const minuteOffset = startMinutes / 60;
  const minuteDuration = ((endHour - startHour) * 60 + (endMinutes - startMinutes)) / 60;

  const eventColor = this.typeColors[event.type];
/**ESTILOS GENERALES DEL EVENTO */
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
    justifyContent: 'space-between'
  };
}

/**FORMATEA EL RANGO DE TIEMPO DE UN EVENTO, CONCATENANDO SU HORA DE INICIO Y FIN */
 formatEventTime(event: CalendarEvent): string {
    return `${event.startTime} - ${event.endTime}`;
  }

  /**OBTIENE EL RANGO DE FECHAS DE LA SEMANA ACTUAL, FORMATEA LOS NOMBRES DE LOS MESES Y FECHAS DE INICIO Y FIN*/
  getWeekRange(): string {
    const startOfWeek = this.getStartOfWeek(this.currentDate);
    const endOfWeek = this.getEndOfWeek(this.currentDate);
    const startMonth = this.getMonthName(startOfWeek.getMonth());
    const endMonth = this.getMonthName(endOfWeek.getMonth());
    return `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${this.currentYear}`;
  }
  
  getStartOfWeek(date: Date): Date {
    /**CALCULA EL PRIMER DÍA (LUNES) DE LA SEMANA DE UNA FECHA DADA */
    const startOfWeek = new Date(date);
    const dayOfWeek = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); /**DEFINE EL LUNES COMO PRIMER DÍA DE LA SEMANA */
    startOfWeek.setDate(diff);
    return startOfWeek;
  }
  
  getEndOfWeek(date: Date): Date {
    /**CALCULA EL ULTIMO DÍA (DOMINGO) DE LA SEMANA DE UNA FECHA DADA */
    const startOfWeek = this.getStartOfWeek(date);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); /**SUMA 6 DÍAS AL INICIO DE LA SEMANA PARA OBTENER EL FIN DE LA SEMANA */
    return endOfWeek;
  }

  changeWeek(direction: number): void {
    /**CAMBIA LA SEMANA ACTUAL SEGUN LA DIRECCION INDICADA (1 SIG, -1 PARA ANTERIOR) */
    this.currentDate.setDate(this.currentDate.getDate() + direction * 7);
    this.updateCalendar(); /**ACTUALLIZAR CALENDARIO */
    this.cdr.detectChanges(); /**DETECCION DE CAMBIOS EN LA VISTA */
  }
  
  getWeekNumber(date: Date): number {
    /**CALCULA EL NUMERO DE SEMANA DEL AÑO PARA UNA FECHA ESPECIFICA */
    const startDate = new Date(date.getFullYear(), 0, 1); /**PRIMER DÍA DEL AÑO */
    const days = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)); /**DIFERENCIA EN DIAS DESDE EL INICIO DE AÑO */
    return Math.ceil((days + 1) / 7); /**CONVIERTE LOS DIAS A NUMERO DE SEMANA */
  }

/**OBTENER DÍAS DE LA SEMANA (LUN A DOM) */
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

/**OBTENER NOMBRE DEL DÍA */
getDayName(dayIndex: number): string {
  const daysOfWeek = [
    'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'
  ];
  return daysOfWeek[dayIndex];
}

/**GENERACIÓN DE HORAS */
generateAvailableTimes(): void {
  const times: string[] = [];
  /**GENERAR HORAS DESDE BASE_HOUR (3 AM) HASTA 12 AM DEL DIA SIGUIENTE */
  for (let hour = this.BASE_HOUR; hour < this.BASE_HOUR + 21; hour++) {
    const adjustedHour = hour % 24; /**RANGO DE HORAS 0-23 */
    const isPM = adjustedHour >= 12;
    const displayHour = adjustedHour > 12 ? adjustedHour - 12 : (adjustedHour === 0 ? 12 : adjustedHour);
    
    /**INTERVALOS DE 15 MINUTOS */
    ['00', '15', '30', '45'].forEach(minute => {
      times.push(`${displayHour.toString().padStart(2, '0')}:${minute} ${isPM ? 'PM' : 'AM'}`);
    });
  }
  
  this.availableTimes = times;
}

/**MANEJO DEL CLICK EN UN CAMPO DE FECHA */
onDateClick(event: Event): void {
  /**VALOR DE INPUT CONVERTIDO A OBJETO DATE Y ACTUALIZAR 'selectDate'  y 'day'*/
  const inputElement = event.target as HTMLInputElement; /**CAST DEL TARGET A UN INPUT HTML */
  const selectedValue = inputElement.value; /**OBTENER VALOR DEL INPUT */
  const selectedDate = new Date(selectedValue); /**CONVERTIR VALOR A FECHA */
  this.selectedDate = selectedDate; /**ASIGNAR FECHA ASIGNADA */
  this.day = this.formatDate(selectedDate); /**FORMATEA LA FECHA Y6 LA ASIGNA A 'day' */
}


/**METODO PARA MANEJAR LOS CAMBIOS EN LA SELECCIÓN DE FECHA */
onDateChange(event: any): void {
  const selectedValue = event.target.value; /**OBTENER VALOR DEL INPUT */
  const [year, month, day] = selectedValue.split('-').map(Number); /**DESCOMPONE EL VALRO EN AÑO, MES Y DÍA */
  this.selectedDate = new Date(year, month - 1, day); /**CREA LA FECHA AJUSTANDO EL MES */
  this.day = selectedValue;
}

/**METODO PARA MANEJAR CAMBIOS EN LA HORA DE INICIO SELECCIONADA */
onStartTimeChange(value: string): void {
  this.selectedStartTime = value; /**ALMACENA HORA DE INICIO */
  this.time = value; /**ACTUALIZA 'time' CON LA HORA SELECCIONADA */
}

/**METODO PARA MANEJAR CAMBIOS EN LA HORA DE FIN SELECCIONADA */
onEndTimeChange(value: string): void {
  this.selectedEndTime = value; /**ALMACENA LA HORA DE FIN */
  this.endDay = value; /**ACTUALIZA 'endDay' EN LA HORA SELECCIONADA */
}

/**METODO PRIVADO PARA FORMATEAR UNA FECHA EN FORMATO 'YYYY-MM-DD' */
private formatDate(date: Date): string {
  const year = date.getFullYear(); /**OBTENER AÑO */
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); /**OBTIENE EL MES EN BASE 0 Y AJUSTA A DOS DIGITOS */
  const day = date.getDate().toString().padStart(2, '0'); /**OBTIENE EL DÍA Y LO AJUSTA A DOS DIGITOS */
  return `${year}-${month}-${day}`; /**RESUELVE LA FECHA FORMATEANDO */
}

/**COLISION DE EVENTOS */
private checkTimeCollision(newEvent: Partial<CalendarEvent>): boolean {
  const newStartTime = newEvent.startTime || ''; /**HORA DE INICIO DEL EVENTO (VACIO POR DEFECTO)*/
  const newEndTime = newEvent.endTime || ''; /**HORA DE FIN DEL NUEVO EVENTO */
  const newDate = newEvent.date; /**FECHA DEL NUEVO EVENTO */

  /**CONVERTIR TIEMPO A MINUTOS DESDE LA MEDIANOCHE */
  /**CONVIERTE EN FORMATO AM/PM A MINUTOS DESDE MEDIANOCHE */
  const getMinutesFromMidnight = (timeString: string): number => {
    const [time, period] = timeString.split(' '); /**DIVIDE EL TIEMPO Y EL PERIODO */
    let [hours, minutes] = time.split(':').map(Number); /**SEPARA HORAS Y MINUTOS */
    /**AJUSTE PARA FORMATO 24H */
    if (period === 'PM' && hours !== 12) {  
      hours += 12; /**SUMA 12 HORAS SI ES PM */
    } else if (period === 'AM' && hours === 12) {
      hours = 0; /**AJUSTA LAS 12 AM A 0 HORAS (MEDIANOCHE) */
    }
    
    return hours * 60 + minutes; /**RETORNO TOTAL EN MINUTOS DESDE LA MEDIANOCHE */
  };

  const newStartMinutes = getMinutesFromMidnight(newStartTime); /**MINUTOS DESDE MEDIANOCHE*/
  const newEndMinutes = getMinutesFromMidnight(newEndTime); /** FIN DEL EVENTO EXISTENTE*/
/**VERIFICAR EVENTOS DEL MISMO DÍA */
  return this.events.some(existingEvent => {
   /**VERIFICAR EVENTOS DEL MISMO DÍA */
    if (existingEvent.date.toDateString() !== newDate?.toDateString()) {
      return false;
    }

    const existingStartMinutes = getMinutesFromMidnight(existingEvent.startTime);
    const existingEndMinutes = getMinutesFromMidnight(existingEvent.endTime);

   /**VERIFICAR SUPERPOSICION PRECISA DE EVENTOS */
    return (
      (newStartMinutes >= existingStartMinutes && newStartMinutes < existingEndMinutes) ||
      (newEndMinutes > existingStartMinutes && newEndMinutes <= existingEndMinutes) ||
      (newStartMinutes <= existingStartMinutes && newEndMinutes >= existingEndMinutes)
    );
  });
}

/**METODO PARA CONVERTIR UNA HORA EN FORMATO 'hh:mm AM/PM' A SU VALOR EN HORAS (0 A 23) */
private timeStringToHour(timeString: string): number {
  const [time, period] = timeString.split(' '); /**DIVIDE EL TIEMPO Y EL PERIODO (AM/PM) */
  let [hours] = time.split(':').map(Number); /**EXTRAER LAS HORAS DEL TIEMPO */
  /**AJUSTA LAS HORAS EN FORMATO DE 24 HORAS */
  if (period === 'PM' && hours !== 12) {
    hours += 12; /**CONVIERTE LAS HORAS PM, EXCEPTO PARA LAS 12 PM */
  } else if (period === 'AM' && hours === 12) {
    hours = 0; /**AJUSTA LAS 12 AM A 0 HORAS (MEDIANOCHE) */
  }
  
  return hours; /**RETORNAR HORA CONVERTIDA */
}
/**CALCULAR DURACION DE EVENTO EN HORAS (COMO DECIMAL) */
private calculateEventDuration(event: CalendarEvent): number {
  const startMinutes = this.timeStringToMinutes(event.startTime); /**MINUTOS DESDE MEDIANOCHE PARA HORA DE INICIO */
  const endMinutes = this.timeStringToMinutes(event.endTime); /**MINUTOS DESDE MEDIANOCHE PARA HORA DE FIN */
  return (endMinutes - startMinutes) / 60; /**RETORNA LA DURACION EN HORAS */
}

/**METODO PARA CALCULAR LOS PORCENTAJES DE TIPO DE EVENTOS */
private calculateActivityPercentages(): void {
/**OBJETO PARA ALMACENAR HORAS TOTALES POR CADA TIPO DE ACTIVIDAD */
  const hoursPerActivity: ActivityStats = {
    estrategica: 0,
    administrativa: 0,
    operativa: 0,
    personal: 0
  };

  /**VARIABLE PARA CALCULAR TOTAL DE HORAS */
  let totalHours = 0;
  
  this.events.forEach(event => {
    const duration = this.calculateEventDuration(event);
    hoursPerActivity[event.type as keyof ActivityStats] += duration;
    totalHours += duration;
  });

  /**SI NO HAY EVENTOS, ESTABLECER EN 0 */
  if (totalHours === 0) {
    this.activityPercentages = {
      estrategica: 0,
      administrativa: 0,
      operativa: 0,
      personal: 0
    };
  } else {
    /**CALCULAR PORCENTAJES */
    Object.keys(hoursPerActivity).forEach(type => {
      const percentage = (hoursPerActivity[type as keyof ActivityStats] / totalHours) * 100;
      this.activityPercentages[type as keyof ActivityStats] = Math.round(percentage);
    });
  }

  /**OBJETO PARA LOS DATOS QUE SE ENVIEN */
  const percentageData = {
    fecha: new Date().toISOString().split('T')[0], /**FECHA ACTUAL EN FORMATO YYYY - MMMM - DDDD */
    estrategica: this.activityPercentages.estrategica,
    administrativa: this.activityPercentages.administrativa,
    operativa: this.activityPercentages.operativa,
    personal: this.activityPercentages.personal
  };

 /**ACTUALIZAR PORCENTAJES USANDO PUT */
  this.http.put(`/api/activity-percentages/${percentageData.fecha}`, percentageData).subscribe({ /**LLAMAR AL METODO */
    next: () => {
      console.log('Porcentajes actualizados exitosamente');
    },
    error: (error) => { /**VALIDACION DE ERRORES */
      console.error('Error al actualizar los porcentajes:', error);
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'error',
        title: 'Error al actualizar los porcentajes de actividades',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    }
  });

  /**FORZAR ACTUALIZACION DE VISTA */
  this.cdr.detectChanges();
}

/**CREACION DE EVENTO POR ARRASTRE (METODOS) */
@HostListener('mousedown', ['$event'])
onCalendarMouseDown(event: MouseEvent) {
/**VERIFICAR SI EL MODAL ESTA ABIERTO */
  if (this.isModalOpen) {
    return;
  }

  const cell = this.findTimeCell(event); /**BUSCAR CELDA DEL CALENDARIO DONDE OCURRIO EL CLICK */
  if (cell && !this.isDragging) {
    this.isDragCreating = true; /**INICIA EL PROCESO DE CREACION MEDIANTE 'drag' */
    this.dragStartCell = cell; /**GUARDA LA CELDA INICIAL DEL 'drag' */
    this.createTemporaryEvent(event); /**CREA UN EVENTO TEMPORAL PARA COMENZAR LA SELECCION */
    event.preventDefault(); /**PREVIENE EL COMPORTAMIENTO DEFAULT DEM LOUSE */
  }
}

/**EJECUCION AL MOVER EL MOUSE */
@HostListener('mousemove', ['$event'])
onCalendarMouseMove(event: MouseEvent) {
/**VERIFICAR SI EL MODAL ESTA ABIERTO */
  if (this.isModalOpen) {
    return; 
  }
/**VERIFICAR SI EL USUARIO ESTA CREANDO UN EVENTO ARRASTRANDO ('dragging') SOBRE EL CALENDARIO */
  if (this.isDragCreating && this.dragStartCell) {
    const cell = this.findTimeCell(event); /**BUSCAR CELDA ACTUAL DEL MOUSE */
    if (cell) {
      this.dragEndCell = {
        day: this.dragStartCell.day, /**MANTENER EL MISMO DIA DEL EVENTO INICIAL */
        hour: cell.hour /**ACTUALIZAR LA HORA DEL EVENTO SEGUN LA POSICIÓN DEL MOUSE */
      };
      this.updateTemporaryEvent(); /**ACTUALIZAR VISUALMENTE EL EVENTO TEMPORAL DURANTE EL 'drop' */
    }
  }
}

/**COMPLETA CREACION DEL EVENTO MEDIANTE 'drag' */
@HostListener('mouseup', ['$event'])
onCalendarMouseUp(event: MouseEvent) {
  if (this.isDragCreating && this.dragStartCell && this.dragEndCell) {
    const weekDays = this.getWeekDays();
    const selectedDate = weekDays[this.dragStartCell.day].date;
    
    /**AJUSTAR HORAS PARA QUE COINCIDAN CON LA VISUALIZACIÓN */
    const startHour = Math.floor(this.dragStartCell.hour);
    const endHour = Math.floor(this.dragEndCell.hour);
    
   /**CALCULAR MINUTOS BASADOS EN LA PARTE DECIMAL DE LA HORA */
   const startMinutes = Math.round((this.dragStartCell.hour % 1) * 60);
   const endMinutes = Math.round((this.dragEndCell.hour % 1) * 60);
    
   /**AJUSTAR INTERVALO DE 15 MIN MAS CERCANO */
    const startMin = Math.round(startMinutes / 15) * 15;
    const endMin = Math.round(endMinutes / 15) * 15;
    
    this.selectedDate = selectedDate;
    this.day = this.formatDate(selectedDate);
    
    /**CALCULAR LOS TIEMPOS CON LOS MINUTOS AJUSTADOS */
    this.selectedStartTime = this.formatTimeStringWithMinutes(startHour, startMin);
    this.selectedEndTime = this.formatTimeStringWithMinutes(endHour, endMin);
    this.time = this.selectedStartTime;
    this.endDay = this.selectedEndTime;
    
    this.openCreateEventModal();
  }
  
  this.cleanupDragCreate();
}

/**METODO PARA FORMATEAR UNA CADENA DE TIEMPO A FORMATO 12 H CON MIN Y SUFIJO AM/PM */
private formatTimeStringWithMinutes(hour: number, minutes: number): string {
  const adjustedHour = Math.floor(hour); /**ASEGURA QUE LA HORA ESTE EN EL RANGO */
  const isPM = adjustedHour >= 12; /**DETERMINA SI LA HORA ES PM */
  const displayHour = adjustedHour > 12 ? adjustedHour - 12 : (adjustedHour === 0 ? 12 : adjustedHour); /**AJUSTA LA HORA PARA FORMATO DE 12 H */
  return `${displayHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`; /**DEVOLVER LA HORA FORMATEADA CON SUFIJO AM/PM */
}
/**ENCUENTRA LA CELDA DE TIEMPO EN EL CALENDARIO DONDE SE HACE CLICK */
private findTimeCell(event: MouseEvent): { day: number, hour: number } | null {
  const calendarGrid = document.querySelector('.calendar'); /**SELECCIONA CONTENEDOR PRINCIPAL */
  if (!calendarGrid) return null;

  const rect = calendarGrid.getBoundingClientRect(); /**OBTIENE LAS COORDENADAS DEL CALENDARIO */
  const calendarScrollTop = (calendarGrid as Element).scrollTop || 0;
  const windowScrollY = window.scrollY;
  /**BUSCA LA CELDA ESPECIFICA QUE CONTIENE LA HORA */
  let target = event.target as HTMLElement;
  while (target && !target.classList.contains('hour')) {
    target = target.parentElement as HTMLElement;
  }

  if (!target) return null;

  const dayIndex = parseInt(target.getAttribute('data-day-index') || '-1'); /**OBTIENE EL INIDICE DEL DÍA */
  const baseHour = parseInt(target.getAttribute('data-hour') || '-1'); /**OBTIENE HORA BASE */

  if (dayIndex === -1 || baseHour === -1) return null;

  const timeColumnWidth = 60; /**ANCHO DE LAS HORAS */
  const headerHeight = 80; /**ALTURA DEL ENCABEZADO DEL CALENDARIO */
  
  const containerTop = rect.top + headerHeight;
  const containerBottom = rect.bottom;
/**VERIFICAR SI EL CLICK OCURRIO DENTRO DEL RANGO VISIBLE DEL CALENDARIO */
  if (event.clientY < containerTop || event.clientY > containerBottom) {
    return null;
  }

/**CALCULAR LA FRACCION DE HORA BASADA EN LA POSICION VERTICAL DENTRO DE LA CELDA */
  const cellRect = target.getBoundingClientRect();
  const relativeY = event.clientY - cellRect.top;
  const quarterHour = Math.floor((relativeY / this.hourHeight) * 4); /**DIVIDIR HORA EN 4 PARTES */

  /**AJUSTAR LA HORA PARA INCLUIR LOS CUARTOS DE HORA, RESTANDO 1 PARA ALINEAR CON LA HORA BASE */
  const adjustedHour = (baseHour === 23) ? baseHour + (quarterHour / 4) : (baseHour - 1) + (quarterHour / 4);

/**AJUSTA LA HORA CONSIDERANDO LA FRACCION DE CAURTO DE HORA */
  const x = event.clientX - rect.left - timeColumnWidth;
  const y = event.clientY - rect.top + calendarScrollTop + windowScrollY;
  const adjustedY = y - headerHeight;
  /**VERIFICA SI LA CELDA ENCONTRADA ES VALIDA */
  if (
    dayIndex >= 0 && 
    dayIndex < 7 && 
    adjustedHour >= this.BASE_HOUR && 
    adjustedHour < this.BASE_HOUR + 21 && 
    adjustedY >= 0
  ) {
    return { day: dayIndex, hour: adjustedHour }; /**DEVUELVE CELDA ENCONTRADA */
  }

  return null; /**RETORNA NULO SI NO SE ENCONTRO UNA CELDA VACIA */
}

/**METODO PARA CREAR EVENTO TEMPORAL */
private createTemporaryEvent(event: MouseEvent) {
  if (!this.dragStartCell) return; /**VERIFICA DONDE COMENZO EL ARRASTRE */

  this.temporaryEventElement = document.createElement('div');
  this.temporaryEventElement.className = 'temporary-event';
  document.body.appendChild(this.temporaryEventElement);
  this.updateTemporaryEvent();
}
/**ACTUALIZA EL TAMAÑO, POSICIÓN Y CONTENIDO DEL EVENTO TEMPORAL MIENTRAS EL USUARIO ARRASTRE EL MOUSE */
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
  
/**FORMATEAR HROAS PARA MOSTRARLAS */
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

  /**ACTUALIZAR EL CONTENIDO DEL EVENTO TEMPORAL USANDO FLEXBOX PARA EL POSICIONAMIENTO */
  this.temporaryEventElement.innerHTML = `
    <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
      <div style="font-family: Arial, sans-serif; Lunasima font-size: 14px; font-weight: bold;">(title)</div>
      <div style="font-family: Arial, sans-serif; font-size: 14px;">${startTimeDisplay} - ${endTimeDisplay}</div>
    </div>
  `;
/**ASIGNAR ESTILOS GENERALES */
  Object.assign(this.temporaryEventElement.style, {
    position: 'fixed',
    left: `${left}px`,
    top: `${finalTop}px`,
    width: `${Math.floor(dayWidth)}px`,
    height: `${Math.max(0, finalHeight)}px`,
    backgroundColor: this.typeColors['perso'].backgroundColor,
    borderLeft: `8px solid ${this.typeColors['perso'].borderColor}`,
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
/**CONVERTIR UNA HORA EN FORMATO HH:MM AM/PM A MINUTOS TOTALES DESDE LA MEDIANOCHE */
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

/**LIMPIA LOS ESTAODS Y ELIMINA EL EVENTO TEMPORAL DE ARRASTRE DESPUES DE QUE EL USUARIO SUELTA EL MOUSE */
private cleanupDragCreate() {
  if (this.temporaryEventElement) {
    this.temporaryEventElement.remove(); /**SI temporalyEventElement EXISTE LO ELIMINA COLOCA NULL */
    this.temporaryEventElement = null;
  }
  this.isDragCreating = false; /**INDICA QUE YA NO SE ESTA CREANDO UN EVENTO */
  this.dragStartCell = null; /*PONE NULO PARA LIMPIAR INFORMACION */
  this.dragEndCell = null; /**NULO PARA LIMPIAR INFORMACION */
}
}
