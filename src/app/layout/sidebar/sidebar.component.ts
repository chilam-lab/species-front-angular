
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';


@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterLink]
})
export class SidebarComponent {
  private _collapsed = false;

  readonly currentUser$;

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

