import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-termo-consentimento',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './termo-consentimento.component.html',
  styleUrl: './termo-consentimento.component.scss',
})
export class TermoConsentimentoComponent {
  readonly versao = '2026-05-06-v1';
}
