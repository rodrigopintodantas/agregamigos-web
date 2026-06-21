import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
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
      .wa-auto-status {
        margin: 0.35rem 0 0.75rem;
        font-size: 0.88rem;
        color: #475467;
      }
      .wa-auto-status strong {
        color: #1570ef;
      }
      .wa-qr-loading {
        margin-top: 12px;
        padding: 1rem;
        border: 1px dashed #84caff;
        border-radius: 8px;
        background: #f0f9ff;
        color: #175cd3;
        font-size: 0.92rem;
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
export class WhatsappComponent implements OnInit, OnDestroy {
  private whatsappService = inject(WhatsappService);
  private auth = inject(AutenticacaoService);

  private readonly pollingIntervalMs = 2500;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private pollingCanalId: number | null = null;

  /** Só o login `admin` pode cadastrar novos celulares/canais. */
  get podeAdicionarCelular(): boolean {
    return this.auth.isLoginAdminSistema();
  }

  carregando = true;
  conectando = false;
  desconectando = false;
  trocandoTelefone = false;
  criandoCanal = false;
  atualizandoStatus = false;
  pollingAtivo = false;
  erro = '';
  sucesso = '';

  canais: WhatsappCanal[] = [];
  canalSelecionadoId: number | null = null;
  nomeNovoCanal = '';

  get canalSelecionado(): WhatsappCanal | null {
    if (!this.canalSelecionadoId) return null;
    return this.canais.find((c) => c.id === this.canalSelecionadoId) ?? null;
  }

  get aguardandoQrCode(): boolean {
    const canal = this.canalSelecionado;
    if (!canal || canal.conectado) return false;
    return this.pollingAtivo && !canal.qrCode && this.statusEmAndamento(canal.status);
  }

  ngOnInit(): void {
    this.carregarCanais();
  }

  ngOnDestroy(): void {
    this.pararPolling();
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
        this.sincronizarPollingCanalSelecionado();
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
    this.sincronizarPollingCanalSelecionado();
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
    this.sucesso = 'Iniciando conexão…';
    this.conectando = true;
    this.whatsappService.conectarCanal(canal.id, { nomePerfil: canal.nome }).subscribe({
      next: (ret) => {
        this.atualizarCanalNaLista(ret);
        this.conectando = false;
        this.tratarRetornoAcaoConexao(ret);
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível conectar o WhatsApp.';
        this.conectando = false;
        this.pararPolling();
      },
    });
  }

  desconectar(): void {
    const canal = this.canalSelecionado;
    if (!canal) return;
    this.erro = '';
    this.sucesso = '';
    this.pararPolling();
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
    this.sucesso = 'Preparando novo QR Code…';
    this.trocandoTelefone = true;
    this.whatsappService.trocarTelefoneCanal(canal.id, { nomePerfil: canal.nome }).subscribe({
      next: (ret) => {
        this.atualizarCanalNaLista(ret);
        this.trocandoTelefone = false;
        this.tratarRetornoAcaoConexao(ret);
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível trocar o telefone do WhatsApp.';
        this.trocandoTelefone = false;
        this.pararPolling();
      },
    });
  }

  private statusEmAndamento(status: string | null | undefined): boolean {
    const s = String(status ?? '');
    return s === 'aguardando_qr' || s === 'conectando' || s === 'reconectando';
  }

  private deveManterPolling(canal: WhatsappCanal | null | undefined): boolean {
    if (!canal) return false;
    if (canal.conectado) return false;
    return this.statusEmAndamento(canal.status) || Boolean(canal.qrCode);
  }

  private sincronizarPollingCanalSelecionado(): void {
    const canal = this.canalSelecionado;
    if (this.deveManterPolling(canal)) {
      this.iniciarPolling(canal!.id);
      return;
    }
    this.pararPolling();
  }

  private iniciarPolling(canalId: number): void {
    if (this.pollingCanalId === canalId && this.pollingTimer) return;

    this.pararPolling();
    this.pollingCanalId = canalId;
    this.pollingAtivo = true;
    this.consultarStatusCanal(canalId);
    this.pollingTimer = setInterval(() => this.consultarStatusCanal(canalId), this.pollingIntervalMs);
  }

  private pararPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.pollingCanalId = null;
    this.pollingAtivo = false;
    this.atualizandoStatus = false;
  }

  private consultarStatusCanal(canalId: number): void {
    this.atualizandoStatus = true;
    this.whatsappService.statusCanal(canalId).subscribe({
      next: (ret) => {
        this.atualizarCanalNaLista(ret);
        this.atualizandoStatus = false;

        if (ret.conectado) {
          this.sucesso = ret.numero
            ? `WhatsApp conectado com sucesso (${ret.numero}).`
            : 'WhatsApp conectado com sucesso.';
          this.pararPolling();
          return;
        }

        if (ret.qrCode) {
          this.sucesso = 'Escaneie o QR Code no WhatsApp deste aparelho.';
          return;
        }

        if (ret.status === 'conectando' || ret.status === 'reconectando') {
          this.sucesso = 'Aguardando conexão…';
          return;
        }

        if (ret.status === 'desconectado') {
          this.pararPolling();
        }
      },
      error: () => {
        this.atualizandoStatus = false;
      },
    });
  }

  private tratarRetornoAcaoConexao(ret: WhatsappCanal & { message?: string }): void {
    if (ret.conectado) {
      this.sucesso = ret.numero
        ? `WhatsApp conectado com sucesso (${ret.numero}).`
        : ret.message || 'WhatsApp conectado com sucesso.';
      this.pararPolling();
      return;
    }

    if (ret.qrCode) {
      this.sucesso = ret.message || 'Escaneie o QR Code no WhatsApp deste aparelho.';
      this.iniciarPolling(ret.id);
      return;
    }

    this.sucesso = ret.message || 'Aguardando conexão…';
    this.iniciarPolling(ret.id);
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
