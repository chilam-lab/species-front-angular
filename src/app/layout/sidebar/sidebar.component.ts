
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common'; 


@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class SidebarComponent {
  private _collapsed = false;

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

