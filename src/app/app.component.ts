import { Component, inject } from '@angular/core';
import { I18nService } from 'taxon-shared';
import { APP_I18N } from './i18n/app.i18n';
import { AUTH_I18N } from './i18n/auth.i18n';
import { PROFILE_I18N } from './i18n/profile.i18n';
import { NICHO_I18N } from './i18n/nicho.i18n';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { HeaderComponent } from './layout/header/header.component';
import { SidebarComponent } from './layout/sidebar/sidebar.component';

import { environment } from '../environments/environment';

console.log('app ENV production:', environment.production);
console.log('app API base:', environment.apiBaseUrl);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, SidebarComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  sidebarCollapsed = true;

  constructor() {
    const i18n = inject(I18nService);
    i18n.register(APP_I18N);
    i18n.register(AUTH_I18N);
    i18n.register(PROFILE_I18N);
    i18n.register(NICHO_I18N);
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
