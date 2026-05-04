import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { BairroQuantidade, PessoaService } from '../../../service/pessoa.service';
import { AutenticacaoService } from '../../../service/autenticacao.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.dashboard.component.html',
  styleUrl: './admin.dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  auth = inject(AutenticacaoService);
  private pessoaService = inject(PessoaService);

  totalCadastros = 0;
  topBairros: BairroQuantidade[] = [];
  carregando = true;
  erro = '';

  ngOnInit(): void {
    this.carregarEstatisticas();
  }

  carregarEstatisticas(): void {
    this.carregando = true;
    this.erro = '';
    this.pessoaService.estatisticas().subscribe({
      next: (data) => {
        this.totalCadastros = data.total_cadastros;
        this.topBairros = data.bairros ?? [];
        this.carregando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar os dados do painel.';
        this.carregando = false;
      },
    });
  }
}
