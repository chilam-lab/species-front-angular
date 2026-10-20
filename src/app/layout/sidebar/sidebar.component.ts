
import { Component, Input, inject } from '@angular/core';
import { I18nService, Lang, TranslatePipe } from 'taxon-shared';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';


@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe]
})
export class SidebarComponent {
  private _collapsed = false;

  readonly currentUser$;
  readonly i18n = inject(I18nService);

  /** "Idioma" en la barra lateral: alterna ES → EN → PT. */
  cycleLang() {
    const order: Lang[] = ['es', 'en', 'pt'];
    this.i18n.setLang(order[(order.indexOf(this.i18n.lang()) + 1) % order.length]);
  }

  constructor(private auth: AuthService) {
    this.currentUser$ = this.auth.currentUser$;
  }

  @Input()
  set collapsed(value: boolean) {
    this._collapsed = value ?? false;
  }

  get collapsed(): boolean {
    return this._collapsed;
  }

  toggleSidebar() {
    console.log(this.collapsed)

    this._collapsed = !this._collapsed;
  }
}

