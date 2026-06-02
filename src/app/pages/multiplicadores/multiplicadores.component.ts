import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  MultiplicadorComparativoItem,
  MultiplicadorCoordenadorItem,
  MultiplicadoresPainelResponse,
  MultiplicadoresService,
  MultiplicadorSerieMensal,
} from '../../service/multiplicadores.service';

@Component({
  selector: 'app-multiplicadores',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './multiplicadores.component.html',
  styleUrl: './multiplicadores.component.scss',
})
export class MultiplicadoresComponent implements OnInit {
  private multiplicadoresService = inject(MultiplicadoresService);

  carregando = true;
  erro = '';
  painel: MultiplicadoresPainelResponse | null = null;

  readonly evolucaoSvgW = 840;
  readonly evolucaoSvgH = 400;
  readonly evolucaoPad = { l: 52, r: 28, t: 24, b: 72 };

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.multiplicadoresService.painel().subscribe({
      next: (data) => {
        this.painel = data;
        this.carregando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar o painel de multiplicadores.';
        this.carregando = false;
      },
    });
  }

  get comparativo(): MultiplicadorComparativoItem[] {
    return this.painel?.comparativo ?? [];
  }

  get coordenadores(): MultiplicadorCoordenadorItem[] {
    return this.painel?.coordenadores ?? [];
  }

  get maxComparativo(): number {
    return Math.max(1, ...this.comparativo.map((c) => c.total));
  }

  percBarraComparativo(total: number): number {
    return Math.round((total / this.maxComparativo) * 1000) / 10;
  }

  labelMes(mes: string): string {
    const [y, m] = mes.split('-');
    const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const idx = Number(m) - 1;
    return `${nomes[idx] ?? m}/${String(y).slice(-2)}`;
  }

  evolucaoPlotX(index: number, total: number): number {
    const innerW = this.evolucaoSvgW - this.evolucaoPad.l - this.evolucaoPad.r;
    if (total <= 1) return this.evolucaoPad.l + innerW / 2;
    return this.evolucaoPad.l + (innerW * index) / (total - 1);
  }

  evolucaoPlotY(val: number, maxY: number): number {
    const innerH = this.evolucaoSvgH - this.evolucaoPad.t - this.evolucaoPad.b;
    const max = Math.max(1, maxY);
    return this.evolucaoPad.t + innerH * (1 - val / max);
  }

  evolucaoPolylinePoints(serie: MultiplicadorSerieMensal): string {
    const meses = this.painel?.evolucao_mensal.meses ?? [];
    const maxY = this.painel?.evolucao_mensal.max_y ?? 1;
    return meses
      .map((_, j) => {
        const x = this.evolucaoPlotX(j, meses.length);
        const y = this.evolucaoPlotY(serie.totais[j], maxY);
        return `${this.arredondarSvg(x)},${this.arredondarSvg(y)}`;
      })
      .join(' ');
  }

  evolucaoCorSerie(index: number): string {
    const hues = [262, 200, 25, 340, 145, 15, 310, 175, 220, 55, 120, 280];
    return `hsl(${hues[index % hues.length]} 58% 40%)`;
  }

  evolucaoTicksY(maxY: number): number[] {
    const n = 4;
    const max = Math.max(1, maxY);
    const raw = Array.from({ length: n + 1 }, (_, i) => Math.round((max * i) / n));
    return [...new Set(raw)].sort((a, b) => a - b);
  }

  evolucaoLegendaCurta(rotulo: string, max = 48): string {
    if (rotulo.length <= max) return rotulo;
    return `${rotulo.slice(0, max - 1)}…`;
  }

  evolucaoAriaLabel(): string {
    const ev = this.painel?.evolucao_mensal;
    if (!ev?.meses.length) return 'Evolução mensal de cadastros por coordenador.';
    const ini = this.labelMes(ev.meses[0]);
    const fim = this.labelMes(ev.meses[ev.meses.length - 1]);
    return `Cadastros por mês de ${ev.series.length} coordenador(es), de ${ini} a ${fim}.`;
  }

  trackByCoordenadorId(_: number, c: MultiplicadorCoordenadorItem): number {
    return c.id;
  }

  trackByComparativo(_: number, c: MultiplicadorComparativoItem): number {
    return c.coordenador_id;
  }

  private arredondarSvg(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
