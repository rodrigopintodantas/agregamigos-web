import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import {
  EngajamentoWhatsapp,
  PessoaItem,
  PessoaPayload,
  PessoaService,
  RegistroNaoImportadoCsv,
} from '../../service/pessoa.service';
import { AutenticacaoService } from '../../service/autenticacao.service';
import {
  lerArquivoTextoCsv,
  normalizarCabecalhoCsv,
  parseCsvPessoa,
  possuiColunaNomeCsv,
  possuiColunaTelefoneCsv,
  prepararTelefonesCsv,
} from '../../utils/importar-csv-pessoa.util';

const CHAVE_VAZIO = '__vazio__';
const STORAGE_ULTIMA_IMPORTACAO_CSV = 'agregamigos_ultima_importacao_csv';

type UltimaImportacaoCsv = {
  ids: number[];
  total: number;
  sem_whatsapp: number;
  importado_em: string;
};

const COLUNAS_FILTRO = ['bairro', 'candidato', 'erro_whatsapp', 'engajamento'] as const;
type PessoaFiltroCol = (typeof COLUNAS_FILTRO)[number];

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
export class PessoaComponent implements OnInit, OnDestroy {
  private pessoaService = inject(PessoaService);
  auth = inject(AutenticacaoService);

  /** Painel de filtro ancorado na viewport (fora do overflow da tabela). */
  painelFiltroEstilo: Record<string, string> | null = null;
  private filtroTriggerEl: HTMLElement | null = null;
  private readonly reposicionarPainel = (): void => {
    if (this.colunaFiltroAberta && this.filtroTriggerEl) {
      this.posicionarPainelFiltro();
    }
  };

  pessoas: PessoaItem[] = [];
  opcoesDistintasPorColuna: Record<string, string[]> = {};
  filtrosColuna: Record<string, string[]> = {};
  colunaFiltroAberta: PessoaFiltroCol | null = null;
  termoBuscaFiltro = '';

  termoPesquisa = '';
  carregando = true;
  erro = '';
  dialogAberto = false;
  salvando = false;
  erroDialog = '';
  editandoId: number | null = null;
  importandoCsv = false;
  desfazendoImportacaoCsv = false;
  ultimaImportacaoCsv: UltimaImportacaoCsv | null = null;
  exportandoPlanilha = false;
  menuAcoesAberto = false;
  mensagemImportacao = '';
  dialogDuplicadosAberto = false;
  nomesDuplicadosImportacao: string[] = [];
  registrosNaoImportadosImportacao: RegistroNaoImportadoCsv[] = [];
  paginaAtual = 1;
  itensPorPagina = 10;
  readonly opcoesItensPorPagina = [10, 20, 50, 100];
  readonly opcoesEngajamento: { value: EngajamentoWhatsapp; label: string }[] = [
    { value: 'sem_resposta', label: 'Sem resposta' },
    { value: 'positivo', label: 'Positivo' },
    { value: 'negativo', label: 'Negativo' },
    { value: 'neutro', label: 'Neutro' },
  ];

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
    this.carregarUltimaImportacaoCsv();
    this.carregarPessoas();
    window.addEventListener('scroll', this.reposicionarPainel, true);
    window.addEventListener('resize', this.reposicionarPainel);
  }

  ngOnDestroy(): void {
    this.fecharPainelFiltro();
    window.removeEventListener('scroll', this.reposicionarPainel, true);
    window.removeEventListener('resize', this.reposicionarPainel);
  }

  get pessoasFiltradas(): PessoaItem[] {
    let lista = this.pessoas.filter((p) => this.passouFiltrosColuna(p));
    const termo = this.termoPesquisa.trim().toLowerCase();
    if (!termo) {
      return lista;
    }

    return lista.filter((p) => {
      const campos = [
        p.nome ?? '',
        p.email ?? '',
        p.whatsapp ?? '',
        p.endereco?.bairro ?? '',
        p.candidato_nome ?? '',
        p.candidato_slug ?? '',
        p.erro_whatsapp ? 'erro whatsapp' : 'sem erro',
        this.labelEngajamento(p),
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
        this.filtrosColuna = {};
        this.fecharPainelFiltro();
        this.atualizarOpcoesDistintas();
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

  toggleMenuAcoes(ev: MouseEvent): void {
    ev.stopPropagation();
    this.menuAcoesAberto = !this.menuAcoesAberto;
  }

  acionarImportarCsv(input: HTMLInputElement): void {
    this.menuAcoesAberto = false;
    this.abrirSeletorCsv(input);
  }

  podeDesfazerUltimaImportacaoCsv(): boolean {
    return (this.ultimaImportacaoCsv?.ids?.length ?? 0) > 0;
  }

  textoAjudaDesfazerUltimaImportacao(): string {
    if (this.podeDesfazerUltimaImportacaoCsv()) {
      return `Remove os ${this.ultimaImportacaoCsv?.total ?? 0} registro(s) da última importação CSV.`;
    }
    return 'Disponível após importar um CSV com a API atualizada. Se a importação foi anterior, use "Desfazer cadastros recentes (2h)".';
  }

  desfazerUltimaImportacaoCsv(): void {
    if (!this.auth.isLoginAdminSistema()) return;
    this.menuAcoesAberto = false;
    const ids = this.ultimaImportacaoCsv?.ids ?? [];
    if (!ids.length) {
      this.erro =
        'Não há importação registrada para desfazer. Use o menu ⋯ → "Desfazer cadastros recentes (2h)" ou reinicie a API e importe o CSV novamente.';
      return;
    }

    const total = this.ultimaImportacaoCsv?.total ?? ids.length;
    const semTel = this.ultimaImportacaoCsv?.sem_whatsapp ?? 0;
    const detalheSemTel =
      semTel > 0 ? `\n\n${semTel} cadastro(s) ficaram sem telefone na importação anterior.` : '';
    const ok = window.confirm(
      `Desfazer a última importação CSV?\n\nSerão removidos ${total} registro(s) adicionados nessa importação.${detalheSemTel}\n\nDepois você pode importar o arquivo novamente.`,
    );
    if (!ok) return;

    this.erro = '';
    this.desfazendoImportacaoCsv = true;
    this.pessoaService.desfazerImportacaoCsv(ids).subscribe({
      next: (resp) => {
        this.desfazendoImportacaoCsv = false;
        this.limparUltimaImportacaoCsv();
        this.mensagemImportacao = resp.message ?? 'Importação desfeita.';
        this.carregarPessoas();
      },
      error: (err) => {
        this.desfazendoImportacaoCsv = false;
        this.erro = err?.error?.message ?? 'Não foi possível desfazer a importação.';
      },
    });
  }

  desfazerImportacaoRecentes(): void {
    if (!this.auth.isLoginAdminSistema()) return;
    this.menuAcoesAberto = false;
    this.erro = '';
    this.desfazendoImportacaoCsv = true;
    const minutos = 120;

    this.pessoaService.previewDesfazerImportacaoRecentes(minutos).subscribe({
      next: (preview) => {
        this.desfazendoImportacaoCsv = false;
        if (!preview.total) {
          this.erro = `Nenhum cadastro criado nos últimos ${minutos} minutos.`;
          return;
        }

        const amostra = (preview.nomes_amostra ?? []).filter(Boolean).slice(0, 8);
        const listaNomes = amostra.length ? `\n\nExemplos:\n• ${amostra.join('\n• ')}` : '';
        const sufixo =
          preview.total > amostra.length ? `\n… e mais ${preview.total - amostra.length}.` : '';
        const ok = window.confirm(
          `Remover ${preview.total} cadastro(s) criado(s) nos últimos ${minutos} minutos?${listaNomes}${sufixo}\n\nCadastros manuais feitos nesse período também serão excluídos. Continuar?`,
        );
        if (!ok) return;

        this.desfazendoImportacaoCsv = true;
        this.pessoaService.desfazerImportacaoRecentes(minutos).subscribe({
          next: (resp) => {
            this.desfazendoImportacaoCsv = false;
            this.limparUltimaImportacaoCsv();
            this.mensagemImportacao = resp.message ?? 'Cadastros recentes removidos.';
            this.carregarPessoas();
          },
          error: (err) => {
            this.desfazendoImportacaoCsv = false;
            this.erro = err?.error?.message ?? 'Não foi possível desfazer os cadastros recentes.';
          },
        });
      },
      error: (err) => {
        this.desfazendoImportacaoCsv = false;
        this.erro =
          err?.error?.message ??
          'Não foi possível consultar cadastros recentes. Reinicie a API e tente novamente.';
      },
    });
  }

  exportarPlanilha(): void {
    this.menuAcoesAberto = false;
    this.erro = '';
    const lista = this.pessoasFiltradas;
    if (!lista.length) {
      this.erro = 'Não há pessoas para exportar com os filtros atuais.';
      return;
    }

    this.exportandoPlanilha = true;
    try {
      const linhas = lista.map((p) => ({
        'Nome Completo': p.nome ?? '',
        'Telefone com DDD (preferencialmente Whatsapp)': this.celulaTextoPlanilha(p.whatsapp),
        'Data de Nascimento': this.formatarDataNascimentoCsv(p.data_nascimento),
        email: p.email ?? '',
        'Perfil do Instagram': p.instagram ?? '',
        Indicacao: p.indicacao ?? '',
        Endereço: p.endereco?.logradouro ?? '',
        'Região Administrativa': p.endereco?.bairro ?? '',
        CEP: this.celulaTextoPlanilha(p.endereco?.cep),
        Cidade: p.endereco?.cidade ?? '',
        UF: p.endereco?.uf ?? '',
        'Erro WhatsApp': p.erro_whatsapp ? 'sim' : 'nao',
        'Engajamento WhatsApp': this.labelEngajamento(p),
      }));

      const planilha = XLSX.utils.json_to_sheet(linhas);
      planilha['!cols'] = [
        { wch: 32 },
        { wch: 22 },
        { wch: 14 },
        { wch: 28 },
        { wch: 22 },
        { wch: 18 },
        { wch: 28 },
        { wch: 22 },
        { wch: 12 },
        { wch: 18 },
        { wch: 6 },
        { wch: 14 },
        { wch: 20 },
      ];

      const livro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(livro, planilha, 'Pessoas');
      const nomeArquivo = `pessoas-${this.slugArquivoExportacao()}-${this.dataArquivoExportacao()}.xlsx`;
      XLSX.writeFile(livro, nomeArquivo, { compression: true });
      this.mensagemImportacao = `Planilha exportada com ${lista.length} registro(s).`;
    } catch {
      this.erro = 'Não foi possível gerar a planilha.';
    } finally {
      this.exportandoPlanilha = false;
    }
  }

  abrirSeletorCsv(input: HTMLInputElement): void {
    this.mensagemImportacao = '';
    this.dialogDuplicadosAberto = false;
    this.nomesDuplicadosImportacao = [];
    this.registrosNaoImportadosImportacao = [];
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
      const csv = await lerArquivoTextoCsv(file);
      const registros = parseCsvPessoa(csv);
      if (!registros.length) {
        this.importandoCsv = false;
        this.erro = 'CSV vazio ou sem linhas válidas.';
        input.value = '';
        return;
      }

      const headers = Object.keys(registros[0]).map((h) => normalizarCabecalhoCsv(h));
      if (!possuiColunaNomeCsv(headers)) {
        this.importandoCsv = false;
        this.erro =
          "CSV inválido: coluna de nome não encontrada. Use 'Nome Completo:' (ou variações como 'nome' e 'nome_completo').";
        input.value = '';
        return;
      }

      if (!possuiColunaTelefoneCsv(headers)) {
        const continuar = window.confirm(
          'Não foi encontrada uma coluna de telefone/WhatsApp neste CSV (ex.: "Telefone com DDD", "Celular", "WhatsApp").\n\nSe continuar, os cadastros serão importados sem telefone.\n\nDeseja continuar mesmo assim?',
        );
        if (!continuar) {
          this.importandoCsv = false;
          input.value = '';
          return;
        }
      }

      prepararTelefonesCsv(registros);

      this.pessoaService.importarCsv({ registros }).subscribe({
        next: (resp) => {
          this.importandoCsv = false;
          this.mensagemImportacao = resp.message ?? 'CSV importado com sucesso.';
          this.registrosNaoImportadosImportacao = this.normalizarRegistrosNaoImportados(resp);
          this.nomesDuplicadosImportacao = this.registrosNaoImportadosImportacao
            .filter((r) => r.motivo === 'nome_duplicado')
            .map((r) => r.nome);
          this.dialogDuplicadosAberto = this.registrosNaoImportadosImportacao.length > 0;
          this.salvarUltimaImportacaoCsv(resp);
          this.carregarPessoas();
          input.value = '';
        },
        error: (err) => {
          this.importandoCsv = false;
          const body = err?.error;
          this.registrosNaoImportadosImportacao = this.normalizarRegistrosNaoImportados(body ?? {});
          this.dialogDuplicadosAberto = this.registrosNaoImportadosImportacao.length > 0;
          this.erro = body?.message ?? 'Não foi possível importar o CSV.';
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
      engajamento_whatsapp: this.engajamentoKey(pessoa),
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
    this.registrosNaoImportadosImportacao = [];
    this.nomesDuplicadosImportacao = [];
  }

  labelMotivoNaoImportado(motivo: RegistroNaoImportadoCsv['motivo']): string {
    if (motivo === 'whatsapp_duplicado') {
      return 'WhatsApp já cadastrado';
    }
    return 'Nome já cadastrado';
  }

  formatarWhatsappImportacao(value?: string | null): string {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return '—';
    return this.formatarWhatsapp(digits);
  }

  private chaveStorageUltimaImportacaoCsv(): string {
    const slug = this.auth.getCandidatoSlug() || 'default';
    return `${STORAGE_ULTIMA_IMPORTACAO_CSV}_${slug}`;
  }

  private carregarUltimaImportacaoCsv(): void {
    try {
      let raw = sessionStorage.getItem(this.chaveStorageUltimaImportacaoCsv());
      if (!raw) {
        raw = this.buscarUltimaImportacaoCsvSalva();
      }
      if (!raw) {
        this.ultimaImportacaoCsv = null;
        return;
      }
      const parsed = JSON.parse(raw) as UltimaImportacaoCsv;
      const ids = Array.isArray(parsed.ids)
        ? parsed.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : [];
      if (!ids.length) {
        this.ultimaImportacaoCsv = null;
        return;
      }
      this.ultimaImportacaoCsv = {
        ids,
        total: Number(parsed.total) || ids.length,
        sem_whatsapp: Number(parsed.sem_whatsapp) || 0,
        importado_em: parsed.importado_em ?? '',
      };
    } catch {
      this.ultimaImportacaoCsv = null;
    }
  }

  private buscarUltimaImportacaoCsvSalva(): string | null {
    let melhorRaw: string | null = null;
    let melhorEm = 0;
    const prefixo = `${STORAGE_ULTIMA_IMPORTACAO_CSV}_`;

    for (let i = 0; i < sessionStorage.length; i += 1) {
      const chave = sessionStorage.key(i);
      if (!chave?.startsWith(prefixo)) continue;
      const raw = sessionStorage.getItem(chave);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as UltimaImportacaoCsv;
        const em = Date.parse(parsed.importado_em ?? '') || 0;
        if (em >= melhorEm) {
          melhorEm = em;
          melhorRaw = raw;
        }
      } catch {
        /* ignore */
      }
    }
    return melhorRaw;
  }

  private salvarUltimaImportacaoCsv(resp: { ids_importados?: number[]; total?: number; sem_whatsapp?: number }): void {
    const ids = Array.isArray(resp.ids_importados)
      ? resp.ids_importados.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    if (!ids.length) {
      this.limparUltimaImportacaoCsv();
      if ((resp.total ?? 0) > 0) {
        this.erro =
          'Importação concluída, mas o desfazer automático não foi registrado. Reinicie a API e use o menu ⋯ → "Desfazer cadastros recentes (2h)".';
      }
      return;
    }
    this.ultimaImportacaoCsv = {
      ids,
      total: Number(resp.total) || ids.length,
      sem_whatsapp: Number(resp.sem_whatsapp) || 0,
      importado_em: new Date().toISOString(),
    };
    sessionStorage.setItem(this.chaveStorageUltimaImportacaoCsv(), JSON.stringify(this.ultimaImportacaoCsv));
  }

  private limparUltimaImportacaoCsv(): void {
    this.ultimaImportacaoCsv = null;
    sessionStorage.removeItem(this.chaveStorageUltimaImportacaoCsv());
  }

  private normalizarRegistrosNaoImportados(resp: {
    registros_nao_importados?: RegistroNaoImportadoCsv[];
    nomes_duplicados?: string[];
  }): RegistroNaoImportadoCsv[] {
    const lista = Array.isArray(resp.registros_nao_importados) ? resp.registros_nao_importados : [];
    if (lista.length) return lista;

    const nomes = Array.isArray(resp.nomes_duplicados) ? resp.nomes_duplicados : [];
    return nomes.map((nome) => ({
      nome,
      whatsapp: null,
      motivo: 'nome_duplicado' as const,
      cadastro_existente: null,
    }));
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
    if (this.editandoId != null) {
      payload.engajamento_whatsapp = this.form.engajamento_whatsapp ?? 'sem_resposta';
    } else {
      delete payload.engajamento_whatsapp;
    }

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
    return this.labelEngajamentoPorKey(this.engajamentoKey(p));
  }

  private labelEngajamentoPorKey(k: 'sem_resposta' | 'positivo' | 'negativo' | 'neutro'): string {
    switch (k) {
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

  tituloPainelFiltro(col: PessoaFiltroCol): string {
    switch (col) {
      case 'bairro':
        return 'Bairro';
      case 'candidato':
        return 'Candidato';
      case 'erro_whatsapp':
        return 'Erro WhatsApp?';
      case 'engajamento':
        return 'Engajamento';
    }
  }

  private valorChaveFiltro(p: PessoaItem, col: PessoaFiltroCol): string {
    switch (col) {
      case 'bairro':
        return (p.endereco?.bairro ?? '').trim() || CHAVE_VAZIO;
      case 'candidato':
        return (p.candidato_nome ?? '').trim() || CHAVE_VAZIO;
      case 'erro_whatsapp':
        return p.erro_whatsapp ? 'erro' : 'sem';
      case 'engajamento':
        return this.engajamentoKey(p);
      default:
        return CHAVE_VAZIO;
    }
  }

  rotuloOpcaoFiltro(col: PessoaFiltroCol, chave: string): string {
    if (chave === CHAVE_VAZIO) return '(vazio)';
    if (col === 'erro_whatsapp') {
      if (chave === 'erro') return 'Erro WhatsApp';
      if (chave === 'sem') return 'Sem erro';
    }
    if (col === 'engajamento') {
      return this.labelEngajamentoPorKey(chave as 'sem_resposta' | 'positivo' | 'negativo' | 'neutro');
    }
    return chave;
  }

  opcoesFiltroParaColuna(col: PessoaFiltroCol): string[] {
    return this.opcoesDistintasPorColuna[col] ?? [];
  }

  opcoesFiltroFiltradas(col: PessoaFiltroCol): string[] {
    const todas = this.opcoesFiltroParaColuna(col);
    const q = this.termoBuscaFiltro.trim().toLowerCase();
    if (!q) return todas;
    return todas.filter((chave) => {
      const rotulo = this.rotuloOpcaoFiltro(col, chave).toLowerCase();
      return rotulo.includes(q) || chave.toLowerCase().includes(q);
    });
  }

  painelFiltroAbertoPara(col: PessoaFiltroCol): boolean {
    return this.colunaFiltroAberta === col;
  }

  alternarPainelFiltro(col: PessoaFiltroCol, ev: MouseEvent): void {
    ev.stopPropagation();
    const btn = ev.currentTarget as HTMLElement;
    if (this.colunaFiltroAberta === col) {
      this.fecharPainelFiltro();
      return;
    }
    this.colunaFiltroAberta = col;
    this.termoBuscaFiltro = '';
    this.filtroTriggerEl = btn;
    setTimeout(() => {
      this.posicionarPainelFiltro();
      requestAnimationFrame(() => this.posicionarPainelFiltro());
      document.querySelector<HTMLInputElement>('.filtro-dropdown-busca-input')?.focus();
    });
  }

  colunaComFiltroAtivo(col: PessoaFiltroCol): boolean {
    return (this.filtrosColuna[col]?.length ?? 0) > 0;
  }

  resumoFiltroColuna(col: PessoaFiltroCol): string {
    const sel = this.filtrosColuna[col];
    const total = this.opcoesFiltroParaColuna(col).length;
    if (!sel?.length) {
      return 'Todos';
    }
    if (sel.length === total) {
      return 'Todos';
    }
    return `${sel.length} selec.`;
  }

  opcaoFiltroMarcada(col: PessoaFiltroCol, chave: string): boolean {
    return this.filtrosColuna[col]?.includes(chave) ?? false;
  }

  alternarOpcaoFiltro(col: PessoaFiltroCol, chave: string): void {
    const atual = [...(this.filtrosColuna[col] ?? [])];
    const i = atual.indexOf(chave);
    if (i >= 0) {
      atual.splice(i, 1);
    } else {
      atual.push(chave);
    }
    const todas = this.opcoesFiltroParaColuna(col);
    if (atual.length === 0 || atual.length === todas.length) {
      delete this.filtrosColuna[col];
    } else {
      this.filtrosColuna[col] = atual;
    }
    this.paginaAtual = 1;
  }

  limparFiltroColuna(col: PessoaFiltroCol, ev: MouseEvent): void {
    ev.stopPropagation();
    delete this.filtrosColuna[col];
    this.paginaAtual = 1;
  }

  private atualizarOpcoesDistintas(): void {
    const map: Record<PessoaFiltroCol, Set<string>> = {
      bairro: new Set(),
      candidato: new Set(),
      erro_whatsapp: new Set(),
      engajamento: new Set(),
    };
    for (const p of this.pessoas) {
      for (const col of COLUNAS_FILTRO) {
        map[col].add(this.valorChaveFiltro(p, col));
      }
    }

    const next: Record<string, string[]> = {};
    for (const col of COLUNAS_FILTRO) {
      const vals = Array.from(map[col]).sort((a, b) => {
        if (col === 'engajamento') {
          const ordem = ['sem_resposta', 'positivo', 'neutro', 'negativo'];
          const ia = ordem.indexOf(a);
          const ib = ordem.indexOf(b);
          if (ia >= 0 && ib >= 0) return ia - ib;
          if (ia >= 0) return -1;
          if (ib >= 0) return 1;
        }
        if (a === CHAVE_VAZIO) return -1;
        if (b === CHAVE_VAZIO) return 1;
        if (col === 'erro_whatsapp') {
          const ordemErro = ['sem', 'erro'];
          return ordemErro.indexOf(a) - ordemErro.indexOf(b);
        }
        return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
      });
      next[col] = vals;
    }
    this.opcoesDistintasPorColuna = next;
  }

  private passouFiltrosColuna(p: PessoaItem): boolean {
    for (const col of COLUNAS_FILTRO) {
      const selecionados = this.filtrosColuna[col];
      if (!selecionados?.length) continue;
      const chave = this.valorChaveFiltro(p, col);
      if (!selecionados.includes(chave)) {
        return false;
      }
    }
    return true;
  }

  private fecharPainelFiltro(): void {
    this.colunaFiltroAberta = null;
    this.painelFiltroEstilo = null;
    this.filtroTriggerEl = null;
    this.termoBuscaFiltro = '';
  }

  private posicionarPainelFiltro(): void {
    const trigger = this.filtroTriggerEl;
    if (!trigger || !this.colunaFiltroAberta) {
      return;
    }
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margem = 8;
    const panelWidth = Math.min(288, vw - margem * 2);
    let left = r.left;
    if (left + panelWidth > vw - margem) {
      left = vw - margem - panelWidth;
    }
    if (left < margem) {
      left = margem;
    }

    const espacoAbaixo = vh - r.bottom - margem;
    const espacoAcima = r.top - margem;
    let top: number;
    let maxPainel: number;

    if (espacoAbaixo >= 180 || espacoAbaixo >= espacoAcima) {
      top = r.bottom + 4;
      maxPainel = Math.min(280, Math.max(100, espacoAbaixo - 4));
    } else {
      maxPainel = Math.min(280, Math.max(100, espacoAcima - 4));
      top = r.top - 4 - maxPainel;
    }

    if (top < margem) {
      maxPainel = Math.max(80, maxPainel - (margem - top));
      top = margem;
    }

    this.painelFiltroEstilo = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${panelWidth}px`,
      maxHeight: `${maxPainel}px`,
      zIndex: '5000',
    };
  }

  @HostListener('document:click', ['$event'])
  fecharPainelFiltroSeFora(ev: MouseEvent): void {
    const alvo = ev.target as HTMLElement | null;
    if (
      !alvo?.closest?.('.filtro-col-wrap') &&
      !alvo?.closest?.('.filtro-dropdown-panel--portal')
    ) {
      this.fecharPainelFiltro();
    }
    if (!alvo?.closest?.('.pessoas-acoes-menu-wrap')) {
      this.menuAcoesAberto = false;
    }
  }

  private formatarDataNascimentoCsv(value?: string | null): string {
    if (!value) return '';
    const raw = String(value).trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return `${iso[3]}/${iso[2]}/${iso[1]}`;
    }
    return raw;
  }

  /** Evita que Excel converta telefone/CEP numérico para notação científica. */
  private celulaTextoPlanilha(value?: string | null): string {
    const s = String(value ?? '').trim();
    return s;
  }

  private slugArquivoExportacao(): string {
    const slug = this.pessoas[0]?.candidato_slug;
    if (slug) {
      return String(slug)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
    return 'exportacao';
  }

  private dataArquivoExportacao(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }

}
