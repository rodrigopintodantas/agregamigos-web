import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VotacaoItem, VotacaoService } from '../../service/votacao.service';

/** Cabeçalhos esperados no CSV (iguais às colunas da tabela `votacao`, exceto id e timestamps). */
export const CABECALHOS_CSV_VOTACAO = [
  'sg_uf',
  'nr_zona',
  'cd_cargo',
  'ds_cargo',
  'nr_candidato',
  'nm_candidato',
  'nm_urna_candidato',
  'sg_partido',
  'ds_composicao_coligacao',
  'nr_turno',
  'ds_sit_totalizacao',
  'nm_tipo_destinacao_votos',
  'dt_ult_totalizacao',
  'pc_votos_validos',
  'qt_votos_nom_validos',
  'qt_votos_concorrentes',
] as const;

const COLUNAS_OCULTAS_NA_TABELA = new Set([
  'dt_ult_totalizacao',
  'pc_votos_validos',
  'nm_candidato',
]);

@Component({
  selector: 'app-votacao',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './votacao.component.html',
  styleUrl: './votacao.component.scss',
})
export class VotacaoComponent implements OnInit {
  private votacaoService = inject(VotacaoService);

  /** Colunas exibidas na grade (CSV continua exigindo o cabeçalho completo). */
  readonly colunasExibicao = (CABECALHOS_CSV_VOTACAO as readonly string[]).filter(
    (c) => !COLUNAS_OCULTAS_NA_TABELA.has(c),
  );

  votacoes: VotacaoItem[] = [];
  termoPesquisa = '';
  carregando = true;
  erro = '';
  importandoCsv = false;
  mensagemImportacao = '';
  paginaAtual = 1;
  itensPorPagina = 10;
  readonly opcoesItensPorPagina = [10, 20, 50, 100];

  ngOnInit(): void {
    this.carregar();
  }

  get votacoesFiltradas(): VotacaoItem[] {
    const termo = this.termoPesquisa.trim().toLowerCase();
    if (!termo) {
      return this.votacoes;
    }
    return this.votacoes.filter((v) => this.textoLinha(v).includes(termo));
  }

  get totalPaginas(): number {
    const total = Math.ceil(this.votacoesFiltradas.length / this.itensPorPagina);
    return Math.max(total, 1);
  }

  get votacoesPaginadas(): VotacaoItem[] {
    const inicio = (this.paginaAtual - 1) * this.itensPorPagina;
    const fim = inicio + this.itensPorPagina;
    return this.votacoesFiltradas.slice(inicio, fim);
  }

  get paginasVisiveis(): number[] {
    const maxBotoes = 5;
    const total = this.totalPaginas;
    if (total <= maxBotoes) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const metade = Math.floor(maxBotoes / 2);
    let inicio = this.paginaAtual - metade;
    let fim = this.paginaAtual + metade;

    if (inicio < 1) {
      inicio = 1;
      fim = maxBotoes;
    } else if (fim > total) {
      fim = total;
      inicio = total - maxBotoes + 1;
    }

    return Array.from({ length: fim - inicio + 1 }, (_, index) => inicio + index);
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.votacaoService.listar().subscribe({
      next: (lista) => {
        this.votacoes = lista;
        this.paginaAtual = 1;
        this.carregando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar os dados de votação.';
        this.carregando = false;
      },
    });
  }

  abrirSeletorCsv(input: HTMLInputElement): void {
    this.mensagemImportacao = '';
    input.click();
  }

  async importarCsv(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.erro = '';
    this.mensagemImportacao = '';
    this.importandoCsv = true;

    try {
      const csv = await this.lerArquivoTexto(file);
      const registros = this.parseCsv(csv);
      if (!registros.length) {
        this.importandoCsv = false;
        this.erro = 'CSV vazio ou sem linhas válidas.';
        input.value = '';
        return;
      }

      const chaves = Object.keys(registros[0]).map((h) => this.normalizarCabecalhoCsv(h));
      const faltando = (CABECALHOS_CSV_VOTACAO as readonly string[]).filter((c) => !chaves.includes(c));
      if (faltando.length) {
        this.importandoCsv = false;
        this.erro = `CSV inválido: faltam colunas obrigatórias: ${faltando.join(', ')}.`;
        input.value = '';
        return;
      }

      this.votacaoService.importarCsv({ registros }).subscribe({
        next: (resp) => {
          this.importandoCsv = false;
          this.mensagemImportacao = resp.message ?? 'CSV importado com sucesso.';
          this.carregar();
          input.value = '';
        },
        error: (err) => {
          this.importandoCsv = false;
          this.erro = err?.error?.message ?? 'Não foi possível importar o CSV.';
          input.value = '';
        },
      });
    } catch {
      this.importandoCsv = false;
      this.erro = 'Não foi possível ler o arquivo CSV.';
      input.value = '';
    }
  }

  aoAlterarPesquisa(): void {
    this.paginaAtual = 1;
  }

  aoAlterarItensPorPagina(): void {
    this.paginaAtual = 1;
  }

  paginaAnterior(): void {
    if (this.paginaAtual > 1) {
      this.paginaAtual -= 1;
    }
  }

  proximaPagina(): void {
    if (this.paginaAtual < this.totalPaginas) {
      this.paginaAtual += 1;
    }
  }

  irParaPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaAtual = pagina;
  }

  valorCelula(v: VotacaoItem, col: string): string | number | null {
    const row = v as unknown as Record<string, unknown>;
    const raw = row[col];
    if (raw === undefined || raw === null) return '—';
    if (col === 'dt_ult_totalizacao' && typeof raw === 'string') {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? raw : d.toLocaleString('pt-BR');
    }
    if (typeof raw === 'number') return raw;
    const s = String(raw).trim();
    return s.length ? s : '—';
  }

  private textoLinha(v: VotacaoItem): string {
    const row = v as unknown as Record<string, unknown>;
    const partes = [String(v.id ?? '')];
    for (const c of CABECALHOS_CSV_VOTACAO as readonly string[]) {
      const val = row[c];
      partes.push(val != null ? String(val) : '');
    }
    return partes.join(' ').toLowerCase();
  }

  private parseCsv(content: string): Record<string, string>[] {
    const lines = content
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) return [];

    const tabCount = lines[0].match(/\t/g)?.length ?? 0;
    const semicolonCount = lines[0].match(/;/g)?.length ?? 0;
    const commaCount = lines[0].match(/,/g)?.length ?? 0;
    const separator =
      tabCount >= semicolonCount && tabCount >= commaCount ? '\t' : semicolonCount > commaCount ? ';' : ',';
    const headers = this.parseCsvLine(lines[0], separator).map((h) => this.sanitizarCabecalhoCsv(h));

    return lines.slice(1).map((line) => {
      const values = this.parseCsvLine(line, separator);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? '';
      });
      return row;
    });
  }

  private parseCsvLine(line: string, separator: string): string[] {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i += 1;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === separator && !insideQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  private normalizarCabecalhoCsv(value: string): string {
    return String(value ?? '')
      .replace(/^\uFEFF/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toLowerCase();
  }

  private sanitizarCabecalhoCsv(value: string): string {
    return String(value ?? '')
      .replace(/^\uFEFF/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
  }

  private async lerArquivoTexto(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const utf8 = new TextDecoder('utf-8').decode(buffer);
    if (!utf8.includes('\uFFFD')) return utf8;
    return new TextDecoder('windows-1252').decode(buffer);
  }
}
