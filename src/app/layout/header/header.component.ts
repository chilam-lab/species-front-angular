import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true
})
export class HeaderComponent {
  @Output() toggleSidebar = new EventEmitter<void>();

  onToggleClick() {
    this.toggleSidebar.emit();
  }
}
