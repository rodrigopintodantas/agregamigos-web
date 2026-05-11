import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PessoaItem, PessoaPayload, PessoaService } from '../../service/pessoa.service';

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  erro?: boolean;
};

@Component({
  selector: 'app-pessoa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pessoa.component.html',
  styleUrl: './pessoa.component.scss',
})
export class PessoaComponent implements OnInit {
  private pessoaService = inject(PessoaService);

  pessoas: PessoaItem[] = [];
  termoPesquisa = '';
  carregando = true;
  erro = '';
  dialogAberto = false;
  salvando = false;
  erroDialog = '';
  editandoId: number | null = null;
  importandoCsv = false;
  mensagemImportacao = '';
  dialogDuplicadosAberto = false;
  nomesDuplicadosImportacao: string[] = [];
  paginaAtual = 1;
  itensPorPagina = 10;
  readonly opcoesItensPorPagina = [10, 20, 50, 100];

  form: PessoaPayload = {
    nome: '',
    data_nascimento: null,
    email: null,
    whatsapp: null,
    instagram: null,
    indicacao: null,
    endereco: {
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
      ibge: null,
    },
  };

  ngOnInit(): void {
    this.carregarPessoas();
  }

  get pessoasFiltradas(): PessoaItem[] {
    const termo = this.termoPesquisa.trim().toLowerCase();
    if (!termo) {
      return this.pessoas;
    }

    return this.pessoas.filter((p) => {
      const campos = [
        p.nome ?? '',
        p.email ?? '',
        p.whatsapp ?? '',
        p.endereco?.bairro ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return campos.includes(termo);
    });
  }

  get totalPaginas(): number {
    const total = Math.ceil(this.pessoasFiltradas.length / this.itensPorPagina);
    return Math.max(total, 1);
  }

  get pessoasPaginadas(): PessoaItem[] {
    const inicio = (this.paginaAtual - 1) * this.itensPorPagina;
    const fim = inicio + this.itensPorPagina;
    return this.pessoasFiltradas.slice(inicio, fim);
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

  carregarPessoas(): void {
    this.carregando = true;
    this.erro = '';
    this.pessoaService.listar().subscribe({
      next: (pessoas) => {
        this.pessoas = pessoas;
        this.paginaAtual = 1;
        this.carregando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar pessoas.';
        this.carregando = false;
      },
    });
  }

  abrirDialog(): void {
    this.dialogAberto = true;
    this.erroDialog = '';
    this.editandoId = null;
    this.form = {
      nome: '',
      data_nascimento: null,
      email: null,
      whatsapp: null,
      instagram: null,
      indicacao: null,
      endereco: {
        cep: null,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        uf: null,
        ibge: null,
      },
    };
  }

  abrirSeletorCsv(input: HTMLInputElement): void {
    this.mensagemImportacao = '';
    this.dialogDuplicadosAberto = false;
    this.nomesDuplicadosImportacao = [];
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

      const headers = Object.keys(registros[0]).map((h) => this.normalizarCabecalho(h));
      if (!this.possuiColunaNome(headers)) {
        this.importandoCsv = false;
        this.erro =
          "CSV inválido: coluna de nome não encontrada. Use 'Nome Completo:' (ou variações como 'nome' e 'nome_completo').";
        input.value = '';
        return;
      }

      registros.forEach((row) => {
        for (const key of Object.keys(row)) {
          if (this.normalizarCabecalho(key) === 'telefone com ddd') {
            row[key] = (row[key] ?? '').replace(/\D/g, '');
          }
        }
      });

      this.pessoaService.importarCsv({ registros }).subscribe({
        next: (resp) => {
          this.importandoCsv = false;
          this.mensagemImportacao = resp.message ?? 'CSV importado com sucesso.';
          this.nomesDuplicadosImportacao = Array.isArray(resp.nomes_duplicados) ? resp.nomes_duplicados : [];
          this.dialogDuplicadosAberto = this.nomesDuplicadosImportacao.length > 0;
          this.carregarPessoas();
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

  editarPessoa(pessoa: PessoaItem): void {
    this.dialogAberto = true;
    this.erroDialog = '';
    this.editandoId = pessoa.id;
    this.form = {
      nome: pessoa.nome ?? '',
      data_nascimento: pessoa.data_nascimento ?? null,
      email: pessoa.email ?? null,
      whatsapp: pessoa.whatsapp ?? null,
      instagram: pessoa.instagram ?? null,
      indicacao: pessoa.indicacao ?? null,
      endereco: {
        cep: pessoa.endereco?.cep ?? null,
        logradouro: pessoa.endereco?.logradouro ?? null,
        numero: pessoa.endereco?.numero ?? null,
        complemento: pessoa.endereco?.complemento ?? null,
        bairro: pessoa.endereco?.bairro ?? null,
        cidade: pessoa.endereco?.cidade ?? null,
        uf: pessoa.endereco?.uf ?? null,
        ibge: pessoa.endereco?.ibge ?? null,
      },
    };
  }

  fecharDialog(): void {
    this.dialogAberto = false;
    this.editandoId = null;
  }

  fecharDialogDuplicados(): void {
    this.dialogDuplicadosAberto = false;
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

  async buscarCep(): Promise<void> {
    const cep = (this.form.endereco?.cep ?? '').replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = (await response.json()) as ViaCepResponse;
      if (data.erro) {
        this.erroDialog = 'CEP não encontrado.';
        return;
      }
      this.form.endereco = {
        ...this.form.endereco,
        cep,
        logradouro: data.logradouro ?? null,
        complemento: data.complemento ?? null,
        bairro: data.bairro ?? null,
        cidade: data.localidade ?? null,
        uf: data.uf ?? null,
        ibge: data.ibge ?? null,
      };
      this.erroDialog = '';
    } catch {
      this.erroDialog = 'Não foi possível consultar o CEP.';
    }
  }

  salvar(): void {
    this.erroDialog = '';
    if (!this.form.nome || this.form.nome.trim().length < 3) {
      this.erroDialog = 'Informe nome com pelo menos 3 caracteres.';
      return;
    }
    this.salvando = true;

    const payload: PessoaPayload = {
      ...this.form,
      whatsapp: this.form.whatsapp ? this.form.whatsapp.replace(/\D/g, '') : null,
      endereco: {
        ...this.form.endereco,
        cep: this.form.endereco?.cep ? this.form.endereco.cep.replace(/\D/g, '') : null,
      },
    };

    const request =
      this.editandoId != null
        ? this.pessoaService.atualizar(this.editandoId, payload)
        : this.pessoaService.criar(payload);

    request.subscribe({
      next: () => {
        this.salvando = false;
        this.dialogAberto = false;
        this.editandoId = null;
        this.carregarPessoas();
      },
      error: (err) => {
        this.salvando = false;
        this.erroDialog = err?.error?.message ?? 'Não foi possível salvar.';
      },
    });
  }

  excluirPessoa(pessoa: PessoaItem): void {
    const ok = window.confirm(`Deseja excluir "${pessoa.nome}"?`);
    if (!ok) return;

    this.pessoaService.excluir(pessoa.id).subscribe({
      next: () => this.carregarPessoas(),
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível excluir.';
      },
    });
  }

  aplicarMascaraWhatsapp(): void {
    const digits = (this.form.whatsapp ?? '').replace(/\D/g, '').slice(0, 11);
    if (!digits) {
      this.form.whatsapp = null;
      return;
    }

    if (digits.length <= 2) {
      this.form.whatsapp = `(${digits}`;
      return;
    }

    if (digits.length <= 6) {
      this.form.whatsapp = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      return;
    }

    if (digits.length <= 10) {
      this.form.whatsapp = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      return;
    }

    this.form.whatsapp = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  aplicarMascaraCep(): void {
    const digits = (this.form.endereco?.cep ?? '').replace(/\D/g, '').slice(0, 8);
    if (!this.form.endereco) return;
    this.form.endereco.cep = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
  }

  formatarWhatsapp(value?: string | null): string {
    const digits = (value ?? '').replace(/\D/g, '').slice(0, 11);
    if (!digits) return '—';
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  engajamentoKey(p: PessoaItem): 'sem_resposta' | 'positivo' | 'negativo' | 'neutro' {
    const v = String(p.engajamento_whatsapp ?? 'sem_resposta').toLowerCase();
    if (v === 'positivo') return 'positivo';
    if (v === 'negativo') return 'negativo';
    if (v === 'neutro') return 'neutro';
    return 'sem_resposta';
  }

  labelEngajamento(p: PessoaItem): string {
    switch (this.engajamentoKey(p)) {
      case 'positivo':
        return 'Positivo';
      case 'negativo':
        return 'Negativo';
      case 'neutro':
        return 'Neutro';
      default:
        return 'Sem resposta';
    }
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
    const separator = tabCount >= semicolonCount && tabCount >= commaCount ? '\t' : semicolonCount > commaCount ? ';' : ',';
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

  private normalizarCabecalho(value: string): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private possuiColunaNome(headers: string[]): boolean {
    const aliases = new Set(['nome completo', 'nome', 'nomecompleto']);
    return headers.some((header) => aliases.has(header.replace(/\s+/g, ' ').trim()));
  }

  /** Remove BOM/zero-width para o nome da coluna bater com o esperado (ex.: `email`). */
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
