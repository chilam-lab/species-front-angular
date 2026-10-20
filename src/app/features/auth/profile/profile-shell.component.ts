import { Component, inject } from '@angular/core';
import { I18nService, TranslatePipe } from 'taxon-shared';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-profile-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  templateUrl: './profile-shell.component.html',
  styleUrls: ['./profile-shell.component.scss']
})
export class ProfileShellComponent {
  readonly i18n = inject(I18nService);
  readonly user$;

  constructor(private auth: AuthService, private router: Router) {
    this.user$ = this.auth.currentUser$;
  }

  logout(): void {
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/login'));
  }
}
