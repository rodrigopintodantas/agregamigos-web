import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AutenticacaoService } from '../../../service/autenticacao.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.dashboard.component.html',
  styleUrl: './admin.dashboard.component.scss'
})
export class AdminDashboardComponent {
  auth = inject(AutenticacaoService);
}
