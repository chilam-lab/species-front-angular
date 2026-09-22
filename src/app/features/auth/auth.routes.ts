import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ProfileShellComponent } from './profile/profile-shell.component';
import { ProfileOverviewComponent } from './profile/profile-overview/profile-overview.component';
import { ProfileSecurityComponent } from './profile/profile-security/profile-security.component';
import { ProfileHistoryComponent } from './profile/profile-history/profile-history.component';
import { MisDatosComponent } from './profile/mis-datos/mis-datos.component';
import { authGuard } from '../../core/auth/auth.guard';

export const authRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  {
    path: 'perfil',
    component: ProfileShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: ProfileOverviewComponent },
      { path: 'seguridad', component: ProfileSecurityComponent },
      { path: 'historial', component: ProfileHistoryComponent },
      { path: 'mis-datos', component: MisDatosComponent },
    ],
  },
];

export default authRoutes;
