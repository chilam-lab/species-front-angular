import { Component, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService, Lang, TranslatePipe } from 'taxon-shared';
import { Subscription, filter } from 'rxjs';
import { ReportIssueDialogComponent } from '../report-issue/report-issue-dialog.component';

/** El título/subtítulo antes eran texto fijo ("Nicho Ecológico...") aunque este
 *  header se muestra en TODAS las rutas (está montado en AppComponent, fuera del
 *  router-outlet) — por eso al entrar a Mi cuenta seguía diciendo "Nicho Ecológico",
 *  dando la impresión de que la navegación te regresaba ahí. Ahora se deriva de la URL. */
// Claves de traducción (APP_I18N) del título/subtítulo según la sección.
const SECTION_BY_PREFIX: { prefix: string; title: string; subtitle: string }[] = [
  { prefix: '/perfil', title: 'app.account', subtitle: 'app.account.sub' },
  { prefix: '/login', title: 'app.account', subtitle: 'app.login.sub' },
  { prefix: '/register', title: 'app.account', subtitle: 'app.register.sub' },
  { prefix: '/forgot-password', title: 'app.account', subtitle: 'app.forgot.sub' },
];
const DEFAULT_SECTION = { title: 'app.title', subtitle: 'app.subtitle' };

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe, ReportIssueDialogComponent]
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() toggleSidebar = new EventEmitter<void>();

  title = DEFAULT_SECTION.title;
  subtitle = DEFAULT_SECTION.subtitle;
  reportOpen = false;

  private sub?: Subscription;

  readonly currentUser$;
  readonly i18n = inject(I18nService);
  readonly langs: { code: Lang; label: string }[] = [
    { code: 'es', label: 'ES' }, { code: 'en', label: 'EN' }, { code: 'pt', label: 'PT' },
  ];

  setLang(lang: Lang) {
    this.i18n.setLang(lang);
  }

  constructor(private router: Router, private auth: AuthService) {
    this.currentUser$ = this.auth.currentUser$;
  }

  ngOnInit(): void {
    this.updateSection(this.router.url);
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateSection(e.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private updateSection(url: string): void {
    const match = SECTION_BY_PREFIX.find((s) => url.startsWith(s.prefix));
    this.title = match?.title ?? DEFAULT_SECTION.title;
    this.subtitle = match?.subtitle ?? DEFAULT_SECTION.subtitle;
  }

  onToggleClick() {
    this.toggleSidebar.emit();
  }
}
