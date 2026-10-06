import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';

/** El título/subtítulo antes eran texto fijo ("Nicho Ecológico...") aunque este
 *  header se muestra en TODAS las rutas (está montado en AppComponent, fuera del
 *  router-outlet) — por eso al entrar a Mi cuenta seguía diciendo "Nicho Ecológico",
 *  dando la impresión de que la navegación te regresaba ahí. Ahora se deriva de la URL. */
const SECTION_BY_PREFIX: { prefix: string; title: string; subtitle: string }[] = [
  { prefix: '/perfil', title: 'Mi cuenta', subtitle: 'Perfil, seguridad y datos cargados' },
  { prefix: '/login', title: 'Mi cuenta', subtitle: 'Inicia sesión para continuar' },
  { prefix: '/register', title: 'Mi cuenta', subtitle: 'Crea tu cuenta' },
  { prefix: '/forgot-password', title: 'Mi cuenta', subtitle: 'Recupera tu contraseña' },
];
const DEFAULT_SECTION = { title: 'Nicho Ecológico', subtitle: 'Plataforma de exploración de datos ecológicos' };

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() toggleSidebar = new EventEmitter<void>();

  title = DEFAULT_SECTION.title;
  subtitle = DEFAULT_SECTION.subtitle;

  private sub?: Subscription;

  constructor(private router: Router) {}

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
