import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WhatsappService, WhatsappStatus } from '../../service/whatsapp.service';

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
      @media (max-width: 520px) {
        .wa-actions {
          flex-direction: column;
          align-items: stretch;
        }
        .wa-actions-aside {
          margin-left: 0;
          justify-content: flex-end;
        }
      }
    `,
  ],
})
export class WhatsappComponent implements OnInit {
  private whatsappService = inject(WhatsappService);

  carregando = true;
  conectando = false;
  desconectando = false;
  trocandoTelefone = false;
  erro = '';
  sucesso = '';
  status: WhatsappStatus | null = null;

  nomePerfil = '';

  ngOnInit(): void {
    this.carregarStatus();
  }

  carregarStatus(): void {
    this.carregando = true;
    this.erro = '';
    this.whatsappService.status().subscribe({
      next: (ret) => {
        this.status = ret;
        this.nomePerfil = ret.nomePerfil ?? '';
        this.carregando = false;
      },
      error: (err) => {
        this.erro = err?.error?.message ?? 'Não foi possível carregar o status do WhatsApp.';
        this.carregando = false;
      },
    });
  }

  conectar(): void {
    this.erro = '';
    this.sucesso = '';

    this.conectando = true;
    this.whatsappService
      .conectar({
        nomePerfil: this.nomePerfil.trim() || 'Canal principal',
      })
      .subscribe({
        next: (ret) => {
          this.status = ret;
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
    this.erro = '';
    this.sucesso = '';
    this.desconectando = true;
    this.whatsappService.desconectar().subscribe({
      next: (ret) => {
        this.status = ret;
        this.nomePerfil = '';
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
    const ok = confirm(
      'O número atual será desconectado e a sessão deste canal será apagada. ' +
        'Em seguida aparecerá um novo QR Code para você vincular outro telefone. Deseja continuar?',
    );
    if (!ok) return;

    this.erro = '';
    this.sucesso = '';
    this.trocandoTelefone = true;
    this.whatsappService
      .trocarTelefone({
        nomePerfil: this.nomePerfil.trim() || 'Canal principal',
      })
      .subscribe({
        next: (ret) => {
          this.status = ret;
          this.sucesso = ret.message;
          this.trocandoTelefone = false;
        },
        error: (err) => {
          this.erro = err?.error?.message ?? 'Não foi possível trocar o telefone do WhatsApp.';
          this.trocandoTelefone = false;
        },
      });
  }
}
