import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PessoaPayload, PessoaService } from '../../service/pessoa.service';

type ViaCepResponse = {
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  erro?: boolean;
};

@Component({
  selector: 'app-link-cadastro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './link-cadastro.component.html',
  styleUrl: './link-cadastro.component.scss',
})
export class LinkCadastroComponent {
  private pessoaService = inject(PessoaService);

  salvando = false;
  sucesso = '';
  erro = '';

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

  async buscarCep(): Promise<void> {
    const cep = (this.form.endereco?.cep ?? '').replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = (await response.json()) as ViaCepResponse;
      if (data.erro) {
        this.erro = 'CEP não encontrado.';
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
      this.erro = '';
    } catch {
      this.erro = 'Não foi possível consultar o CEP.';
    }
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

  salvar(): void {
    this.erro = '';
    this.sucesso = '';

    if (!this.form.nome || this.form.nome.trim().length < 3) {
      this.erro = 'Informe nome com pelo menos 3 caracteres.';
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

    this.pessoaService.criarPorLink(payload).subscribe({
      next: () => {
        this.salvando = false;
        this.sucesso = 'Cadastro enviado com sucesso.';
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
      },
      error: (err) => {
        this.salvando = false;
        this.erro = err?.error?.message ?? 'Não foi possível concluir o cadastro.';
      },
    });
  }
}
