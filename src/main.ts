import { bootstrapApplication} from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { importProvidersFrom } from '@angular/core';

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    importProvidersFrom(HttpClientModule),
    ...(appConfig.providers || [])
  ]
}).catch(err => console.error(err));
