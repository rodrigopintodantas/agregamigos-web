import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AutenticacaoService } from '../../service/autenticacao.service';
import { CandidatoResumo } from '../../types/candidato.model';

@Component({
  selector: 'app-selecionar-candidato',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './selecionar-candidato.component.html',
  styleUrl: './selecionar-candidato.component.scss',
})
export class SelecionarCandidatoComponent implements OnInit {
  private auth = inject(AutenticacaoService);
  private router = inject(Router);

  candidatos: CandidatoResumo[] = [];
  carregando = true;
  erro = '';
  selecionandoSlug: string | null = null;

  ngOnInit(): void {
    this.auth.carregarPerfil().subscribe({
      next: (ret) => {
        this.carregando = false;
        this.candidatos = ret.candidatos ?? [];
        if (!this.candidatos.length) {
          this.erro = 'Nenhum candidato vinculado ao seu usuário. Contate o administrador.';
        }
      },
      error: () => {
        this.carregando = false;
        this.erro = 'Não foi possível carregar os candidatos.';
      },
    });
  }

  escolher(c: CandidatoResumo): void {
    this.erro = '';
    this.selecionandoSlug = c.slug;
    this.auth.selecionarCandidato(c.slug).subscribe({
      next: () => {
        this.selecionandoSlug = null;
        const perfil = this.auth.getPerfil();
        const dash = (perfil?.dashboard ?? '/home').replace(/^\//, '');
        void this.router.navigateByUrl(`/${c.slug}/${dash}`);
      },
      error: (err) => {
        this.selecionandoSlug = null;
        this.erro = err?.error?.message ?? 'Não foi possível selecionar o candidato.';
      },
    });
  }
}
