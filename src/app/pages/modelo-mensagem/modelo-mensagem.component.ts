import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ModeloMensagem,
  ModeloMensagemPayload,
  ModeloMensagemService,
  ModeloMensagemTipo,
} from '../../service/modelo-mensagem.service';

type OpcaoBotaoForm = { id: number; texto: string };

@Component({
  selector: 'app-modelo-mensagem',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modelo-mensagem.component.html',
  styleUrl: './modelo-mensagem.component.scss',
})
export class ModeloMensagemComponent implements OnInit {
  private service = inject(ModeloMensagemService);

  readonly maxBotoes = 3;
  readonly minBotoes = 2;
  readonly maxTextoBotao = 20;

  modelos: ModeloMensagem[] = [];
  titulo = '';
  corpo = '';
  tipoMensagem: ModeloMensagemTipo = 'texto';
  private proximoIdOpcaoBotao = 1;
  opcoesBotoes: OpcaoBotaoForm[] = this.criarOpcoesBotoesVazias();
  editandoId: number | null = null;

  carregando = true;
  salvando = false;
  erro = '';
  sucesso = '';

  ngOnInit(): void {
    this.carregar();
  }

  get modeloComBotoes(): boolean {
    return this.tipoMensagem === 'botoes';
  }

  private criarOpcoesBotoesVazias(qtd = 2): OpcaoBotaoForm[] {
    return Array.from({ length: qtd }, () => ({ id: this.proximoIdOpcaoBotao++, texto: '' }));
  }

  trackByOpcaoBotao(_: number, opcao: OpcaoBotaoForm): number {
    return opcao.id;
  }

  atualizarTextoOpcaoBotao(id: number, texto: string): void {
    const opcao = this.opcoesBotoes.find((o) => o.id === id);
    if (!opcao) return;
    opcao.texto = texto;
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.service.listar().subscribe({
      next: (lista) => {
        this.modelos = lista;
        this.carregando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar os modelos.';
        this.carregando = false;
      },
    });
  }

  limparForm(): void {
    this.titulo = '';
    this.corpo = '';
    this.tipoMensagem = 'texto';
    this.opcoesBotoes = this.criarOpcoesBotoesVazias();
    this.editandoId = null;
    this.erro = '';
  }

  alterarTipoMensagem(tipo: ModeloMensagemTipo): void {
    this.tipoMensagem = tipo;
    if (tipo === 'botoes' && this.opcoesBotoes.length < this.minBotoes) {
      this.opcoesBotoes = this.criarOpcoesBotoesVazias();
    }
  }

  adicionarOpcaoBotao(): void {
    if (this.opcoesBotoes.length >= this.maxBotoes) return;
    this.opcoesBotoes = [...this.opcoesBotoes, { id: this.proximoIdOpcaoBotao++, texto: '' }];
  }

  removerOpcaoBotao(id: number): void {
    if (this.opcoesBotoes.length <= this.minBotoes) return;
    this.opcoesBotoes = this.opcoesBotoes.filter((o) => o.id !== id);
  }

  private montarPayload(): ModeloMensagemPayload | null {
    const titulo = this.titulo.trim();
    const corpo = this.corpo.trim();
    if (!titulo || !corpo) {
      this.erro = 'Preencha título e texto do modelo.';
      return null;
    }

    if (this.modeloComBotoes) {
      const opcoes = this.opcoesBotoes.map((o) => o.texto.trim()).filter(Boolean);
      if (opcoes.length < this.minBotoes) {
        this.erro = `Informe pelo menos ${this.minBotoes} opções de botão.`;
        return null;
      }
      const vistos = new Set<string>();
      for (const opcao of opcoes) {
        const chave = opcao.toLowerCase();
        if (vistos.has(chave)) {
          this.erro = 'Cada botão deve ter um texto diferente.';
          return null;
        }
        vistos.add(chave);
        if (opcao.length > this.maxTextoBotao) {
          this.erro = `Cada botão pode ter no máximo ${this.maxTextoBotao} caracteres.`;
          return null;
        }
      }
      return {
        titulo,
        corpo,
        tipo_mensagem: 'botoes',
        opcoes_botoes: opcoes,
      };
    }

    return {
      titulo,
      corpo,
      tipo_mensagem: 'texto',
    };
  }

  criar(): void {
    const payload = this.montarPayload();
    if (!payload) return;

    this.salvando = true;
    this.erro = '';
    this.sucesso = '';
    this.service.criar(payload).subscribe({
      next: () => {
        this.limparForm();
        this.sucesso = 'Modelo criado.';
        this.carregar();
        this.salvando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível salvar.';
        this.salvando = false;
      },
    });
  }

  editar(m: ModeloMensagem): void {
    this.editandoId = m.id;
    this.titulo = m.titulo;
    this.corpo = m.corpo;
    this.tipoMensagem = m.tipo_mensagem === 'botoes' ? 'botoes' : 'texto';
    this.opcoesBotoes =
      m.tipo_mensagem === 'botoes' && m.opcoes_botoes?.length
        ? m.opcoes_botoes.map((texto) => ({ id: this.proximoIdOpcaoBotao++, texto }))
        : this.criarOpcoesBotoesVazias();
    this.erro = '';
    this.sucesso = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  salvarEdicao(): void {
    if (this.editandoId == null) return;
    const payload = this.montarPayload();
    if (!payload) return;

    this.salvando = true;
    this.erro = '';
    this.sucesso = '';
    this.service.atualizar(this.editandoId, payload).subscribe({
      next: () => {
        this.limparForm();
        this.sucesso = 'Modelo atualizado.';
        this.carregar();
        this.salvando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível atualizar.';
        this.salvando = false;
      },
    });
  }

  excluir(m: ModeloMensagem): void {
    if (!window.confirm(`Excluir o modelo "${m.titulo}"?`)) return;
    this.erro = '';
    this.service.excluir(m.id).subscribe({
      next: () => {
        if (this.editandoId === m.id) this.limparForm();
        this.sucesso = 'Modelo excluído.';
        this.erro = '';
        this.carregar();
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível excluir.';
      },
    });
  }

  preview(m: ModeloMensagem, max = 120): string {
    let t = m.corpo.replace(/\s+/g, ' ').trim();
    if (m.tipo_mensagem === 'botoes' && m.opcoes_botoes?.length) {
      t = `${t} [${m.opcoes_botoes.join(' | ')}]`;
    }
    return t.length <= max ? t : `${t.slice(0, max)}…`;
  }

  labelTipo(m: ModeloMensagem): string {
    return m.tipo_mensagem === 'botoes' ? 'Com botões' : 'Texto';
  }

  opcoesBotoesPreview(): string[] {
    return this.opcoesBotoes.map((o) => o.texto.trim()).filter(Boolean);
  }

  inserirVariavel(alvo: HTMLTextAreaElement, token: string): void {
    const inicio = alvo.selectionStart ?? this.corpo.length;
    const fim = alvo.selectionEnd ?? inicio;
    this.corpo = `${this.corpo.slice(0, inicio)}${token}${this.corpo.slice(fim)}`;

    queueMicrotask(() => {
      alvo.focus();
      const cursor = inicio + token.length;
      alvo.setSelectionRange(cursor, cursor);
    });
  }
}
