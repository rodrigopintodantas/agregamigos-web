import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CampanhaDestinatarioDetalhe,
  CampanhaDivulgacaoItem,
  CampanhaDivulgacaoService,
} from '../../service/campanha-divulgacao.service';
import { AutenticacaoService } from '../../service/autenticacao.service';
import { ModeloMensagem, ModeloMensagemService } from '../../service/modelo-mensagem.service';
import { PessoaItem, PessoaService } from '../../service/pessoa.service';
import { WhatsappCanal, WhatsappService } from '../../service/whatsapp.service';

type ItemCampanha = {
  pessoaId: number;
  pessoaNome: string;
  whatsapp: string;
  modeloId: number;
  modeloTitulo: string;
};

@Component({
  selector: 'app-divulgacao',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './divulgacao.component.html',
  styleUrl: './divulgacao.component.scss',
})
export class DivulgacaoComponent implements OnInit {
  private pessoaService = inject(PessoaService);
  private modeloService = inject(ModeloMensagemService);
  private campanhaService = inject(CampanhaDivulgacaoService);
  private whatsappService = inject(WhatsappService);
  private auth = inject(AutenticacaoService);

  /** Só o login `admin` vê e dispara «Iniciar envio» (alinhado ao menu e à API). */
  get podeExibirIniciarEnvioCampanha(): boolean {
    return this.auth.isLoginAdminSistema();
  }

  /** Só o login `admin` pode excluir campanhas. */
  get podeExibirExcluirCampanha(): boolean {
    return this.auth.isLoginAdminSistema();
  }

  /** `false`: botão oculto na UI; fluxo `reprocessarErros` permanece no componente. */
  readonly exibirBotaoReprocessarErros = false;

  campanhas: CampanhaDivulgacaoItem[] = [];
  campanhaAbertaId: number | null = null;
  detalhesCampanha: Record<number, CampanhaDestinatarioDetalhe[]> = {};
  carregandoDetalhe: Record<number, boolean> = {};
  exibindoCriacao = false;
  nomeCampanha = '';
  mensagensPorTurno = 2;
  filtroNome = '';
  filtroBairro = '';

  pessoas: PessoaItem[] = [];
  modelos: ModeloMensagem[] = [];
  canaisWhatsapp: WhatsappCanal[] = [];
  whatsappCanalIdSelecionado: number | null = null;

  selecionadosPessoas = new Set<number>();
  selecionadosModelos = new Set<number>();

  campanhaMontada: ItemCampanha[] = [];

  carregando = true;
  carregandoCriacao = false;
  montando = false;
  salvandoCampanha = false;
  excluindoCampanhaId: number | null = null;
  cancelandoCampanhaId: number | null = null;
  processandoCampanhaId: number | null = null;
  dialogMensagemAberto = false;
  dialogMensagemTitulo = '';
  dialogMensagemDestinatario = '';
  dialogMensagemCorpo = '';

  dialogExcluirAberto = false;
  campanhaParaExcluir: CampanhaDivulgacaoItem | null = null;
  erro = '';
  sucesso = '';

  ngOnInit(): void {
    this.carregarCampanhas();
  }

  carregarCampanhas(): void {
    this.carregando = true;
    this.erro = '';
    this.sucesso = '';
    this.campanhaService.listar().subscribe({
      next: (lista) => {
        this.campanhas = lista;
        this.campanhaAbertaId = null;
        this.detalhesCampanha = {};
        this.carregandoDetalhe = {};
        this.carregando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar as campanhas.';
        this.carregando = false;
      },
    });
  }

  abrirCriacao(): void {
    this.exibindoCriacao = true;
    this.carregandoCriacao = true;
    this.erro = '';
    this.sucesso = '';
    this.campanhaMontada = [];
    this.selecionadosPessoas.clear();
    this.selecionadosModelos.clear();
    this.filtroNome = '';
    this.filtroBairro = '';
    this.mensagensPorTurno = 2;
    this.whatsappCanalIdSelecionado = null;
    this.canaisWhatsapp = [];

    let pessoasOk = false;
    let modelosOk = false;
    let canaisOk = false;
    const finalizar = () => {
      if (pessoasOk && modelosOk && canaisOk) this.carregandoCriacao = false;
    };

    this.pessoaService.listar().subscribe({
      next: (lista) => {
        this.pessoas = lista.filter((p) => this.normalizarWhatsapp(p.whatsapp).length > 0);
        pessoasOk = true;
        finalizar();
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar as pessoas.';
        this.carregandoCriacao = false;
      },
    });

    this.modeloService.listar().subscribe({
      next: (lista) => {
        this.modelos = lista;
        modelosOk = true;
        finalizar();
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar os modelos.';
        this.carregandoCriacao = false;
      },
    });

    this.whatsappService.listarCanais().subscribe({
      next: (lista) => {
        this.canaisWhatsapp = lista;
        const conectado = lista.find((c) => c.conectado);
        this.whatsappCanalIdSelecionado = conectado?.id ?? lista[0]?.id ?? null;
        canaisOk = true;
        finalizar();
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar os celulares WhatsApp.';
        this.carregandoCriacao = false;
      },
    });
  }

  cancelarCriacao(): void {
    this.exibindoCriacao = false;
    this.nomeCampanha = '';
    this.filtroNome = '';
    this.filtroBairro = '';
    this.mensagensPorTurno = 2;
    this.selecionadosPessoas.clear();
    this.selecionadosModelos.clear();
    this.campanhaMontada = [];
    this.canaisWhatsapp = [];
    this.whatsappCanalIdSelecionado = null;
    this.erro = '';
    this.sucesso = '';
  }

  labelCanalWhatsapp(canal: WhatsappCanal): string {
    const status = canal.conectado ? 'conectado' : canal.status || 'desconectado';
    const numero = canal.numero ? ` · ${canal.numero}` : '';
    return `${canal.nome} (${status})${numero}`;
  }

  resumoCanalCampanha(c: CampanhaDivulgacaoItem): string {
    const canal = c.whatsapp_canal;
    if (!canal) return '—';
    const num = canal.numero ? ` (${canal.numero})` : '';
    return `${canal.nome}${num}`;
  }

  get pessoasFiltradas(): PessoaItem[] {
    const nome = this.filtroNome.trim().toLowerCase();
    const bairro = this.filtroBairro.trim().toLowerCase();
    return this.pessoas.filter((p) => {
      const nomeOk = !nome || String(p.nome ?? '').toLowerCase().includes(nome);
      const bairroPessoa = String(p.endereco?.bairro ?? '').toLowerCase();
      const bairroOk = !bairro || bairroPessoa === bairro;
      return nomeOk && bairroOk;
    });
  }

  get bairrosDisponiveis(): string[] {
    return [...new Set(this.pessoas.map((p) => String(p.endereco?.bairro ?? '').trim()).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'pt-BR'),
    );
  }

  get criarCampanhaDesabilitadoPorEmAndamento(): boolean {
    return this.campanhas.some((c) => c.status === 'em_andamento');
  }

  togglePessoa(id: number, checked: boolean): void {
    if (checked) this.selecionadosPessoas.add(id);
    else this.selecionadosPessoas.delete(id);
    this.sucesso = '';
  }

  toggleModelo(id: number, checked: boolean): void {
    if (checked) this.selecionadosModelos.add(id);
    else this.selecionadosModelos.delete(id);
    this.sucesso = '';
  }

  selecionarTodasPessoas(checked: boolean): void {
    this.pessoasFiltradas.forEach((p) => {
      if (checked) this.selecionadosPessoas.add(p.id);
      else this.selecionadosPessoas.delete(p.id);
    });
  }

  todasPessoasFiltradasSelecionadas(): boolean {
    return this.pessoasFiltradas.length > 0 && this.pessoasFiltradas.every((p) => this.selecionadosPessoas.has(p.id));
  }

  montarCampanha(): void {
    this.erro = '';
    this.sucesso = '';
    this.campanhaMontada = [];

    if (!this.nomeCampanha.trim()) {
      this.erro = 'Informe um nome para a campanha.';
      return;
    }
    if (this.selecionadosPessoas.size === 0) {
      this.erro = 'Selecione pelo menos uma pessoa.';
      return;
    }
    if (this.selecionadosModelos.size < 2) {
      this.erro = 'Selecione obrigatoriamente 2 ou mais modelos diferentes.';
      return;
    }
    if (!Number.isInteger(this.mensagensPorTurno) || this.mensagensPorTurno < 1) {
      this.erro = 'Mensagens por turno deve ser um número inteiro maior ou igual a 1.';
      return;
    }
    if (!this.whatsappCanalIdSelecionado) {
      this.erro = 'Selecione o celular que enviará as mensagens da campanha.';
      return;
    }

    const pessoasSelecionadas = this.pessoas
      .filter((p) => this.selecionadosPessoas.has(p.id))
      .sort((a, b) => String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt-BR'));

    const modelosSelecionados = this.modelos
      .filter((m) => this.selecionadosModelos.has(m.id))
      .sort((a, b) => String(a.titulo ?? '').localeCompare(String(b.titulo ?? ''), 'pt-BR'));

    this.montando = true;

    this.campanhaMontada = pessoasSelecionadas.map((pessoa, index) => {
      const modelo = modelosSelecionados[index % modelosSelecionados.length];
      return {
        pessoaId: pessoa.id,
        pessoaNome: pessoa.nome,
        whatsapp: this.formatarWhatsapp(this.normalizarWhatsapp(pessoa.whatsapp)),
        modeloId: modelo.id,
        modeloTitulo: modelo.titulo,
      };
    });

    this.montando = false;
    this.sucesso = `Campanha "${this.nomeCampanha.trim()}" montada com ${this.campanhaMontada.length} destinatário(s).`;
  }

  criarCampanha(): void {
    this.erro = '';
    this.sucesso = '';
    if (!this.campanhaMontada.length) {
      this.erro = 'Monte a campanha antes de salvar.';
      return;
    }
    this.salvandoCampanha = true;
    if (!this.whatsappCanalIdSelecionado) {
      this.erro = 'Selecione o celular que enviará as mensagens da campanha.';
      return;
    }
    this.campanhaService
      .criar({
        nome: this.nomeCampanha.trim(),
        pessoa_ids: [...this.selecionadosPessoas],
        modelo_ids: [...this.selecionadosModelos],
        mensagens_por_turno: this.mensagensPorTurno,
        whatsapp_canal_id: this.whatsappCanalIdSelecionado,
      })
      .subscribe({
        next: () => {
          this.salvandoCampanha = false;
          this.cancelarCriacao();
          this.carregarCampanhas();
        },
        error: (err) => {
          this.salvandoCampanha = false;
          this.erro = err?.error?.message ?? 'Não foi possível criar a campanha.';
        },
      });
  }

  labelStatus(status: string): string {
    switch (status) {
      case 'montada':
        return 'Montada';
      case 'em_andamento':
        return 'Em andamento';
      case 'finalizada':
        return 'Finalizada';
      case 'cancelada':
        return 'Cancelada';
      default:
        return 'Rascunho';
    }
  }

  podeIniciarCampanha(c: CampanhaDivulgacaoItem): boolean {
    return c.status === 'montada' || c.status === 'em_andamento';
  }

  podeCancelarCampanha(c: CampanhaDivulgacaoItem): boolean {
    return c.status === 'em_andamento';
  }

  podeExcluirCampanha(c: CampanhaDivulgacaoItem): boolean {
    return c.status !== 'em_andamento';
  }

  abrirDialogExcluirCampanha(c: CampanhaDivulgacaoItem): void {
    if (!this.podeExibirExcluirCampanha) {
      this.erro = 'Apenas o utilizador com login admin pode excluir campanhas.';
      return;
    }
    if (!this.podeExcluirCampanha(c)) {
      this.erro = 'Campanhas em andamento não podem ser excluídas. Cancele o envio antes.';
      return;
    }
    this.erro = '';
    this.sucesso = '';
    this.campanhaParaExcluir = c;
    this.dialogExcluirAberto = true;
  }

  fecharDialogExcluirCampanha(): void {
    this.dialogExcluirAberto = false;
    this.campanhaParaExcluir = null;
  }

  confirmarExclusaoCampanha(): void {
    const c = this.campanhaParaExcluir;
    if (!c) return;
    if (!this.podeExibirExcluirCampanha) {
      this.erro = 'Apenas o utilizador com login admin pode excluir campanhas.';
      this.fecharDialogExcluirCampanha();
      return;
    }
    if (!this.podeExcluirCampanha(c)) {
      this.erro = 'Campanhas em andamento não podem ser excluídas. Cancele o envio antes.';
      this.fecharDialogExcluirCampanha();
      return;
    }

    this.excluindoCampanhaId = c.id;
    this.campanhaService.excluir(c.id).subscribe({
      next: (ret) => {
        this.excluindoCampanhaId = null;
        this.fecharDialogExcluirCampanha();
        if (this.campanhaAbertaId === c.id) {
          this.campanhaAbertaId = null;
        }
        delete this.detalhesCampanha[c.id];
        delete this.carregandoDetalhe[c.id];
        this.sucesso = ret?.message ?? 'Campanha excluída com sucesso.';
        this.carregarCampanhas();
      },
      error: (err) => {
        this.excluindoCampanhaId = null;
        this.erro = err?.error?.message ?? 'Não foi possível excluir a campanha.';
      },
    });
  }

  iniciarCampanha(c: CampanhaDivulgacaoItem): void {
    this.erro = '';
    this.sucesso = '';
    if (!this.auth.isLoginAdminSistema()) {
      this.erro = 'Apenas o utilizador com login admin pode iniciar o envio da campanha.';
      return;
    }
    if (!this.podeIniciarCampanha(c)) {
      this.erro = 'A campanha só pode ser iniciada quando estiver montada ou em andamento.';
      return;
    }

    this.processandoCampanhaId = c.id;
    this.campanhaService.iniciar(c.id).subscribe({
      next: (ret) => {
        this.processandoCampanhaId = null;
        this.sucesso = ret?.message ?? 'Campanha processada com sucesso.';
        this.carregarCampanhas();
      },
      error: (err) => {
        this.processandoCampanhaId = null;
        this.erro = err?.error?.message ?? 'Não foi possível iniciar o envio da campanha.';
      },
    });
  }

  reprocessarErros(c: CampanhaDivulgacaoItem): void {
    this.erro = '';
    this.sucesso = '';
    this.processandoCampanhaId = c.id;
    this.campanhaService.reprocessarErros(c.id).subscribe({
      next: (ret) => {
        this.processandoCampanhaId = null;
        this.sucesso = ret?.message ?? 'Reprocessamento concluído.';
        this.carregarCampanhas();
      },
      error: (err) => {
        this.processandoCampanhaId = null;
        this.erro = err?.error?.message ?? 'Não foi possível reprocessar os erros da campanha.';
      },
    });
  }

  cancelarCampanha(c: CampanhaDivulgacaoItem): void {
    this.erro = '';
    this.sucesso = '';
    if (!this.podeCancelarCampanha(c)) {
      this.erro = 'A campanha só pode ser cancelada quando estiver em andamento.';
      return;
    }
    if (!window.confirm(`Deseja cancelar a campanha "${c.nome}"?`)) return;

    this.cancelandoCampanhaId = c.id;
    this.campanhaService.cancelar(c.id).subscribe({
      next: (ret) => {
        this.cancelandoCampanhaId = null;
        this.sucesso = ret?.message ?? 'Campanha cancelada com sucesso.';
        this.carregarCampanhas();
      },
      error: (err) => {
        this.cancelandoCampanhaId = null;
        this.erro = err?.error?.message ?? 'Não foi possível cancelar a campanha.';
      },
    });
  }

  labelStatusDestinatario(status: string): string {
    switch (status) {
      case 'enviado':
        return 'Enviado';
      case 'erro':
        return 'Erro';
      case 'cancelado':
        return 'Cancelado';
      default:
        return 'Pendente';
    }
  }

  labelSentimento(s: string | null | undefined): string {
    switch (String(s || '').toLowerCase()) {
      case 'positivo':
        return 'Positivo';
      case 'negativo':
        return 'Negativo';
      case 'neutro':
        return 'Neutro';
      case 'desconhecido':
        return 'Indefinido';
      default:
        return '—';
    }
  }

  resumoResposta(texto: string | null | undefined, max = 72): string {
    const t = String(texto ?? '').trim();
    if (!t) return '—';
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }

  /** Texto da 1ª/2ª resposta com trim (evita string só com espaço). */
  temResposta1(d: CampanhaDestinatarioDetalhe): boolean {
    return String(d.resposta_1_texto ?? '').trim().length > 0;
  }

  temResposta2(d: CampanhaDestinatarioDetalhe): boolean {
    return String(d.resposta_2_texto ?? '').trim().length > 0;
  }

  visualizarCorpoMensagem(d: CampanhaDestinatarioDetalhe): void {
    this.dialogMensagemTitulo = d.modelo?.titulo ? `Modelo: ${d.modelo.titulo}` : 'Modelo da mensagem';
    this.dialogMensagemDestinatario = d.pessoa?.nome ?? 'Destinatário não identificado';
    const template = String(d.modelo?.corpo ?? '');
    this.dialogMensagemCorpo =
      this.aplicarVariaveisMensagem(template, d.pessoa) || 'Corpo da mensagem não disponível para este destinatário.';
    this.dialogMensagemAberto = true;
  }

  fecharDialogMensagem(): void {
    this.dialogMensagemAberto = false;
  }

  /** Lista expandida: mais cedo em `agendado_para` primeiro; sem data no fim. */
  private ordenarDestinatariosPorAgendado(
    lista: CampanhaDestinatarioDetalhe[],
  ): CampanhaDestinatarioDetalhe[] {
    return [...lista].sort((a, b) => {
      const ta = a.agendado_para ? new Date(a.agendado_para).getTime() : Number.NaN;
      const tb = b.agendado_para ? new Date(b.agendado_para).getTime() : Number.NaN;
      const validA = Number.isFinite(ta);
      const validB = Number.isFinite(tb);
      if (!validA && !validB) return (a.ordem ?? 0) - (b.ordem ?? 0);
      if (!validA) return 1;
      if (!validB) return -1;
      if (ta !== tb) return ta - tb;
      return (a.ordem ?? 0) - (b.ordem ?? 0);
    });
  }

  toggleCampanha(campanhaId: number): void {
    if (this.campanhaAbertaId === campanhaId) {
      this.campanhaAbertaId = null;
      return;
    }
    this.campanhaAbertaId = campanhaId;
    // Sempre buscar de novo: respostas chegam depois do primeiro carregamento; cache antigo escondia os dados.
    this.carregandoDetalhe[campanhaId] = true;
    this.campanhaService.detalhe(campanhaId).subscribe({
      next: (detalhe) => {
        this.detalhesCampanha[campanhaId] = this.ordenarDestinatariosPorAgendado(
          detalhe.destinatarios ?? [],
        );
        this.carregandoDetalhe[campanhaId] = false;
      },
      error: (err) => {
        this.carregandoDetalhe[campanhaId] = false;
        this.erro = err?.error?.message ?? 'Não foi possível carregar os destinatários da campanha.';
      },
    });
  }

  private normalizarWhatsapp(value?: string | null): string {
    return String(value ?? '').replace(/\D/g, '');
  }

  private formatarWhatsapp(digits: string): string {
    if (!digits) return '—';
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return digits;
  }

  private aplicarVariaveisMensagem(
    template: string,
    pessoa?: { nome?: string | null; bairro?: string | null; nome_coordenador?: string | null } | null,
  ): string {
    const nomeCompleto = String(pessoa?.nome ?? '').trim();
    const primeiroNome = nomeCompleto ? nomeCompleto.split(/\s+/)[0] : '';
    const bairro = String(pessoa?.bairro ?? '').trim();
    const nomeCoordenador = String(pessoa?.nome_coordenador ?? '').trim();
    return template
      .replace(/\{\{\s*nome\s*\}\}/gi, nomeCompleto)
      .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, primeiroNome)
      .replace(/\{\{\s*bairro\s*\}\}/gi, bairro)
      .replace(/\{\{\s*nome_coordenador\s*\}\}/gi, nomeCoordenador)
      .replace(/XXXX/g, nomeCompleto)
      .trim();
  }
}
