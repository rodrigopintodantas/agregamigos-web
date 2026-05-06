import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WhatsappService, WhatsappStatus } from '../../service/whatsapp.service';

@Component({
  selector: 'app-whatsapp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './whatsapp.component.html',
})
export class WhatsappComponent implements OnInit {
  private whatsappService = inject(WhatsappService);

  carregando = true;
  conectando = false;
  desconectando = false;
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
}
