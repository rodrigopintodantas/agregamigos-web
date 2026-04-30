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

  form: PessoaPayload = {
    nome: '',
    data_nascimento: null,
    email: null,
    whatsapp: null,
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

  carregarPessoas(): void {
    this.carregando = true;
    this.erro = '';
    this.pessoaService.listar().subscribe({
      next: (pessoas) => {
        this.pessoas = pessoas;
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

  editarPessoa(pessoa: PessoaItem): void {
    this.dialogAberto = true;
    this.erroDialog = '';
    this.editandoId = pessoa.id;
    this.form = {
      nome: pessoa.nome ?? '',
      data_nascimento: pessoa.data_nascimento ?? null,
      email: pessoa.email ?? null,
      whatsapp: pessoa.whatsapp ?? null,
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
}
