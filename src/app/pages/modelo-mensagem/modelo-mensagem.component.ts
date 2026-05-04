import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModeloMensagem, ModeloMensagemService } from '../../service/modelo-mensagem.service';

@Component({
  selector: 'app-modelo-mensagem',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modelo-mensagem.component.html',
  styleUrl: './modelo-mensagem.component.scss',
})
export class ModeloMensagemComponent implements OnInit {
  private service = inject(ModeloMensagemService);

  modelos: ModeloMensagem[] = [];
  titulo = '';
  corpo = '';
  editandoId: number | null = null;

  carregando = true;
  salvando = false;
  erro = '';
  sucesso = '';

  ngOnInit(): void {
    this.carregar();
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
    this.editandoId = null;
    this.erro = '';
  }

  criar(): void {
    const titulo = this.titulo.trim();
    const corpo = this.corpo.trim();
    if (!titulo || !corpo) {
      this.erro = 'Preencha título e texto do modelo.';
      return;
    }
    this.salvando = true;
    this.erro = '';
    this.sucesso = '';
    this.service.criar({ titulo, corpo }).subscribe({
      next: () => {
        this.titulo = '';
        this.corpo = '';
        this.editandoId = null;
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
    this.erro = '';
    this.sucesso = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  salvarEdicao(): void {
    if (this.editandoId == null) return;
    const titulo = this.titulo.trim();
    const corpo = this.corpo.trim();
    if (!titulo || !corpo) {
      this.erro = 'Preencha título e texto do modelo.';
      return;
    }
    this.salvando = true;
    this.erro = '';
    this.sucesso = '';
    this.service.atualizar(this.editandoId, { titulo, corpo }).subscribe({
      next: () => {
        this.titulo = '';
        this.corpo = '';
        this.editandoId = null;
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

  preview(texto: string, max = 120): string {
    const t = texto.replace(/\s+/g, ' ').trim();
    return t.length <= max ? t : `${t.slice(0, max)}…`;
  }
}
