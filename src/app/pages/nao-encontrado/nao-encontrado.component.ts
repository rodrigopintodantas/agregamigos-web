import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-nao-encontrado',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page-card">
      <h2>Página não encontrada</h2>
      <a routerLink="/">Voltar para início</a>
    </section>
  `
})
export class NaoEncontradoComponent {}
