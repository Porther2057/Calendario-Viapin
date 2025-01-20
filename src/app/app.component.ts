import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DashboardContentComponent } from "./dashboard-content/dashboard-content.component";

@Component({
  selector: 'app-root',
  imports: [DashboardContentComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Calendario-viapin';
}
