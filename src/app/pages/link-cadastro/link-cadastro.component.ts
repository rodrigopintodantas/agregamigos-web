import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { combineLatest, distinctUntilChanged, map } from 'rxjs';
import { BAIRROS_DISTRITO_FEDERAL } from '../../data/bairros-distrito-federal';
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
export class LinkCadastroComponent implements OnInit {
  private pessoaService = inject(PessoaService);
  private route = inject(ActivatedRoute);
  candidatoSlug = '';
  candidatoTitulo = 'Cadastro';
  carregandoContexto = true;
  erroContexto = '';
  coordenadores: { id: number; nome: string }[] = [];
  idCoordenadorSelecionado: number | null = null;
  /** Quando a URL traz chave de divulgação opaca ou `?coordenador=id` válido, o campo não pode ser alterado. */
  coordenadorTravado = false;
  nomeCoordenadorTravado = '';
  avisoCoordenadorUrl = '';
  tokenEvento = '';
  nomeEvento = '';

  ngOnInit(): void {
    combineLatest([
      this.route.paramMap.pipe(map((pm) => (pm.get('candidatoSlug') ?? '').trim().toLowerCase())),
      this.route.queryParamMap,
    ])
      .pipe(
        map(([slug, qm]) => ({
          slug,
          qm,
          serial: this.serialQueryContexto(slug, qm),
          queryObj: this.queryParamRecord(qm),
          coordRaw: qm.get('coordenador'),
        })),
        distinctUntilChanged((a, b) => a.serial === b.serial),
      )
      .subscribe(({ slug, queryObj, coordRaw }) => {
        this.erroContexto = '';
        this.sucesso = '';
        this.erro = '';
        this.avisoCoordenadorUrl = '';
        this.coordenadorTravado = false;
        this.nomeCoordenadorTravado = '';
        this.tokenEvento = '';
        this.nomeEvento = '';
        this.candidatoSlug = slug;

        if (!slug) {
          this.carregandoContexto = false;
          this.erroContexto = 'Link de cadastro inválido (candidato não informado na URL).';
          this.candidatoTitulo = 'Cadastro';
          return;
        }

        this.carregarContexto(slug, queryObj, coordRaw);
      });
  }

  private queryParamRecord(qm: ParamMap): Record<string, string> {
    const o: Record<string, string> = {};
    qm.keys.forEach((k) => {
      o[k] = qm.get(k) ?? '';
    });
    return o;
  }

  private serialQueryContexto(slug: string, qm: ParamMap): string {
    const o = this.queryParamRecord(qm);
    const parts = Object.keys(o)
      .sort()
      .map((k) => `${k}=${o[k]}`);
    return `${slug}|${parts.join('&')}`;
  }

  private carregarContexto(
    slug: string,
    queryObj: Record<string, string>,
    coordRaw: string | null | undefined,
  ): void {
    this.carregandoContexto = true;
    this.pessoaService.contextoLinkCadastro(slug, queryObj).subscribe({
      next: (ctx) => {
        this.candidatoTitulo = (ctx.candidato?.nome ?? '').trim() || slug;
        this.coordenadores = Array.isArray(ctx.coordenadores) ? ctx.coordenadores : [];
        this.idCoordenadorSelecionado = null;
        this.tokenEvento = ctx.evento?.token_cadastro ?? queryObj['evento']?.trim() ?? '';
        this.nomeEvento = ctx.evento?.nome?.trim() ?? '';
        if (this.nomeEvento) {
          this.candidatoTitulo = this.nomeEvento;
        }
        this.carregandoContexto = false;
        const pre = ctx.preselected_coordenador_id;
        if (pre != null && Number.isInteger(Number(pre)) && Number(pre) > 0) {
          this.aplicarPreselecaoServidor(Number(pre));
        } else {
          this.aplicarQueryCoordenador(coordRaw);
        }
      },
      error: (err) => {
        this.carregandoContexto = false;
        this.erroContexto =
          err?.error?.message ?? 'Não foi possível carregar os dados deste link de cadastro.';
        this.candidatoTitulo = 'Cadastro';
      },
    });
  }

  private aplicarPreselecaoServidor(id: number): void {
    this.avisoCoordenadorUrl = '';
    const found = this.coordenadores.find((c) => c.id === id);
    if (!found) {
      this.coordenadorTravado = false;
      this.nomeCoordenadorTravado = '';
      this.idCoordenadorSelecionado = null;
      this.avisoCoordenadorUrl = 'Link de divulgação inválido ou desatualizado.';
      return;
    }
    this.idCoordenadorSelecionado = id;
    this.coordenadorTravado = true;
    this.nomeCoordenadorTravado = found.nome;
  }

  private aplicarQueryCoordenador(raw: string | null | undefined): void {
    this.avisoCoordenadorUrl = '';
    const vazio = raw == null || String(raw).trim() === '';
    if (vazio) {
      this.coordenadorTravado = false;
      this.nomeCoordenadorTravado = '';
      this.idCoordenadorSelecionado = null;
      return;
    }
    const id = Number(String(raw).trim());
    if (!Number.isInteger(id) || id <= 0) {
      this.coordenadorTravado = false;
      this.nomeCoordenadorTravado = '';
      this.idCoordenadorSelecionado = null;
      this.avisoCoordenadorUrl = 'Parâmetro de coordenador inválido no link.';
      return;
    }
    const found = this.coordenadores.find((c) => c.id === id);
    if (!found) {
      this.coordenadorTravado = false;
      this.nomeCoordenadorTravado = '';
      this.idCoordenadorSelecionado = null;
      this.avisoCoordenadorUrl =
        'Este link aponta para um coordenador que não está disponível neste cadastro. Escolha um coordenador na lista.';
      return;
    }
    this.idCoordenadorSelecionado = id;
    this.coordenadorTravado = true;
    this.nomeCoordenadorTravado = found.nome;
  }

  readonly termoConsentimentoVersao = '2026-05-06-v1';
  readonly termoConsentimentoTexto =
    'Autorizo o tratamento dos meus dados pessoais para fins de cadastro, contato e gestão do relacionamento, nos termos da LGPD.';
  concordaTermo = false;

  salvando = false;
  sucesso = '';
  erro = '';
  bairroDetectadoCep: string | null = null;
  readonly bairrosDistritoFederal = [...BAIRROS_DISTRITO_FEDERAL];

  form: PessoaPayload = {
    nome: '',
    data_nascimento: null,
    email: null,
    whatsapp: null,
    instagram: null,
    endereco: {
      cep: null,
      logradouro: null,
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
    if (!this.candidatoSlug) {
      this.erro = 'Link de cadastro inválido (candidato não informado na URL).';
      return;
    }
    this.salvando = true;
    const payload: PessoaPayload = {
      ...this.form,
      id_coordenador: this.idCoordenadorSelecionado ?? null,
      token_evento: this.tokenEvento || null,
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

    this.pessoaService.criarPorLink(this.candidatoSlug, payload).subscribe({
      next: () => {
        this.salvando = false;
        this.sucesso = 'Cadastro enviado com sucesso.';
        this.form = {
          nome: '',
          data_nascimento: null,
          email: null,
          whatsapp: null,
          instagram: null,
          endereco: {
            cep: null,
            logradouro: null,
            bairro: null,
            cidade: null,
            uf: null,
            ibge: null,
          },
        };
        this.concordaTermo = false;
        this.bairroDetectadoCep = null;
        if (!this.coordenadorTravado) {
          this.idCoordenadorSelecionado = null;
        }
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
