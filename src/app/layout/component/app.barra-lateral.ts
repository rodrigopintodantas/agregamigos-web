import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AppMenu } from './app.menu';

@Component({
  selector: 'app-barra-lateral',
  standalone: true,
  imports: [CommonModule, AppMenu],
  template: `
    <aside class="sidebar">
      <app-menu></app-menu>
    </aside>
  `
})
export class AppBarraLateral {
}
