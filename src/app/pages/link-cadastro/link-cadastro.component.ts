import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './link-cadastro.component.html',
  styleUrl: './link-cadastro.component.scss',
})
export class LinkCadastroComponent {
  private pessoaService = inject(PessoaService);
  readonly termoConsentimentoVersao = '2026-05-06-v1';
  readonly termoConsentimentoTexto =
    'Autorizo o tratamento dos meus dados pessoais para fins de cadastro, contato e gestão do relacionamento, nos termos da LGPD.';
  concordaTermo = false;

  salvando = false;
  sucesso = '';
  erro = '';
  bairroDetectadoCep: string | null = null;
  readonly bairrosDistritoFederal: string[] = [
    'Aguas Claras',
    'Arniqueira',
    'Asa Norte',
    'Asa Sul',
    'Brasilia',
    'Brazlandia',
    'Candangolandia',
    'Ceilandia',
    'Cruzeiro',
    'Fercal',
    'Gama',
    'Guara',
    'Itapoa',
    'Jardim Botanico',
    'Lago Norte',
    'Lago Sul',
    'Nucleo Bandeirante',
    'Park Way',
    'Paranoa',
    'Planaltina',
    'Recanto das Emas',
    'Riacho Fundo',
    'Riacho Fundo II',
    'Samambaia',
    'Santa Maria',
    'Sao Sebastiao',
    'SCIA/Estrutural',
    'SIA',
    'Sobradinho',
    'Sobradinho II',
    'Sol Nascente/Por do Sol',
    'Sudoeste/Octogonal',
    'Taguatinga',
    'Varjao',
    'Vicente Pires',
  ];

  form: PessoaPayload = {
    nome: '',
    data_nascimento: null,
    email: null,
    whatsapp: null,
    instagram: null,
    indicacao: null,
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
        bairro: this.mapearBairroCepParaLista(data.bairro ?? null),
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
    if (!this.concordaTermo) {
      this.erro = 'É necessário concordar com o termo de consentimento para continuar.';
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
      consentimento: {
        aceito: true,
        termo_versao: this.termoConsentimentoVersao,
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
          instagram: null,
          indicacao: null,
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
        this.concordaTermo = false;
        this.bairroDetectadoCep = null;
      },
      error: (err) => {
        this.salvando = false;
        this.erro = err?.error?.message ?? 'Não foi possível concluir o cadastro.';
      },
    });
  }

  private normalizar(value: string): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private mapearBairroCepParaLista(bairro: string | null): string | null {
    const normalizado = this.normalizar(bairro ?? '');
    if (!normalizado) return null;
    const encontrado = this.bairrosDistritoFederal.find((item) => this.normalizar(item) === normalizado);
    if (encontrado) {
      this.bairroDetectadoCep = null;
      return encontrado;
    }

    const valorOriginal = String(bairro ?? '').trim();
    this.bairroDetectadoCep = valorOriginal || null;
    return this.bairroDetectadoCep;
  }
}
