import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutenticacaoService } from '../../service/autenticacao.service';
import { WhatsappCanal, WhatsappService } from '../../service/whatsapp.service';

@Component({
  selector: 'app-whatsapp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './whatsapp.component.html',
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .campo {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        margin-bottom: 1rem;
        max-width: 50%;
        box-sizing: border-box;
      }
      .campo span {
        font-size: 0.85rem;
        color: #344054;
      }
      .campo input {
        border: 1px solid #d0d5dd;
        border-radius: 8px;
        padding: 0.52rem 0.65rem;
      }
      .wa-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.6rem;
        justify-content: space-between;
        margin-top: 0.25rem;
        margin-bottom: 0.8rem;
      }
      .wa-actions-main {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        min-width: 0;
      }
      .wa-actions-aside {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        margin-left: auto;
      }
      .canais-lista {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .canal-item {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        padding: 0.55rem 0.65rem;
        border: 1px solid #e4e7ec;
        border-radius: 8px;
        cursor: pointer;
      }
      .canal-item.ativo {
        border-color: #1570ef;
        background: #eff8ff;
      }
      .novo-canal {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        align-items: flex-end;
        margin-bottom: 1rem;
      }
      @media (max-width: 520px) {
        .wa-actions {
          flex-direction: column;
          align-items: stretch;
        }
        .wa-actions-aside {
          margin-left: 0;
          justify-content: flex-end;
        }
        .campo {
          max-width: 100%;
        }
      }
    `,
  ],
})
export class WhatsappComponent implements OnInit {
  private whatsappService = inject(WhatsappService);
  private auth = inject(AutenticacaoService);

  /** Só o login `admin` pode cadastrar novos celulares/canais. */
  get podeAdicionarCelular(): boolean {
    return this.auth.isLoginAdminSistema();
  }

  carregando = true;
  conectando = false;
  desconectando = false;
  trocandoTelefone = false;
  criandoCanal = false;
  erro = '';
  sucesso = '';

  canais: WhatsappCanal[] = [];
  canalSelecionadoId: number | null = null;
  nomeNovoCanal = '';

  get canalSelecionado(): WhatsappCanal | null {
    if (!this.canalSelecionadoId) return null;
    return this.canais.find((c) => c.id === this.canalSelecionadoId) ?? null;
  }

  ngOnInit(): void {
    this.carregarCanais();
  }

  carregarCanais(selecionarId?: number | null): void {
    this.carregando = true;
    this.erro = '';
    this.whatsappService.listarCanais().subscribe({
      next: (lista) => {
        this.canais = lista;
        const preferido = selecionarId ?? this.canalSelecionadoId;
        if (preferido && lista.some((c) => c.id === preferido)) {
          this.canalSelecionadoId = preferido;
        } else if (lista.length) {
          this.canalSelecionadoId = lista[0].id;
        } else {
          this.canalSelecionadoId = null;
        }
        this.carregando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar os canais WhatsApp.';
        this.carregando = false;
      },
    });
  }

  selecionarCanal(id: number): void {
    this.canalSelecionadoId = id;
    this.sucesso = '';
    this.erro = '';
  }

  criarCanal(): void {
    const nome = this.nomeNovoCanal.trim();
    if (!nome) {
      this.erro = 'Informe um nome para o novo celular/canal.';
      return;
    }
    this.erro = '';
    this.sucesso = '';
    this.criandoCanal = true;
    this.whatsappService.criarCanal({ nome }).subscribe({
      next: (ret) => {
        this.nomeNovoCanal = '';
        this.sucesso = ret.message || 'Canal criado.';
        this.criandoCanal = false;
        this.carregarCanais(ret.id);
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível criar o canal.';
        this.criandoCanal = false;
      },
    });
  }

  labelStatus(canal: WhatsappCanal | null): string {
    if (!canal) return '—';
    if (canal.conectado) return 'Conectado';
    const s = String(canal.status || '');
    if (s === 'aguardando_qr') return 'Aguardando QR';
    if (s === 'conectando' || s === 'reconectando') return 'Conectando…';
    return 'Desconectado';
  }

  conectar(): void {
    const canal = this.canalSelecionado;
    if (!canal) {
      this.erro = 'Selecione um canal.';
      return;
    }
    this.erro = '';
    this.sucesso = '';
    this.conectando = true;
    this.whatsappService.conectarCanal(canal.id, { nomePerfil: canal.nome }).subscribe({
      next: (ret) => {
        this.atualizarCanalNaLista(ret);
        this.sucesso = ret.message;
        this.conectando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível conectar o WhatsApp.';
        this.conectando = false;
      },
    });
  }

  desconectar(): void {
    const canal = this.canalSelecionado;
    if (!canal) return;
    this.erro = '';
    this.sucesso = '';
    this.desconectando = true;
    this.whatsappService.desconectarCanal(canal.id).subscribe({
      next: (ret) => {
        this.atualizarCanalNaLista(ret);
        this.sucesso = ret.message;
        this.desconectando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível desconectar o WhatsApp.';
        this.desconectando = false;
      },
    });
  }

  trocarTelefone(): void {
    const canal = this.canalSelecionado;
    if (!canal) return;
    const ok = confirm(
      `O número do canal "${canal.nome}" será desconectado e a sessão será apagada. ` +
        'Em seguida aparecerá um novo QR Code para vincular outro telefone. Deseja continuar?',
    );
    if (!ok) return;

    this.erro = '';
    this.sucesso = '';
    this.trocandoTelefone = true;
    this.whatsappService.trocarTelefoneCanal(canal.id, { nomePerfil: canal.nome }).subscribe({
      next: (ret) => {
        this.atualizarCanalNaLista(ret);
        this.sucesso = ret.message;
        this.trocandoTelefone = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível trocar o telefone do WhatsApp.';
        this.trocandoTelefone = false;
      },
    });
  }

  private atualizarCanalNaLista(ret: WhatsappCanal): void {
    const idx = this.canais.findIndex((c) => c.id === ret.id);
    if (idx >= 0) {
      this.canais = [...this.canais.slice(0, idx), { ...this.canais[idx], ...ret }, ...this.canais.slice(idx + 1)];
    } else {
      this.carregarCanais(ret.id);
    }
  }
}
