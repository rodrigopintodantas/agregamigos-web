import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EnderecoPayload {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  ibge?: string | null;
}

export interface PessoaPayload {
  nome: string;
  data_nascimento?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  indicacao?: string | null;
  /** Apenas na edição manual (admin). */
  engajamento_whatsapp?: EngajamentoWhatsapp | null;
  /** Usuário coordenador (vínculo com o candidato), ex.: link de cadastro público. */
  id_coordenador?: number | null;
  /** Token do evento quando o cadastro vem de link de evento. */
  token_evento?: string | null;
  endereco?: EnderecoPayload;
  consentimento?: {
    aceito: boolean;
    termo_versao: string;
  };
}

export type EngajamentoWhatsapp = 'sem_resposta' | 'positivo' | 'negativo' | 'neutro';

export interface PessoaItem {
  id: number;
  nome: string;
  data_nascimento?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  erro_whatsapp?: boolean;
  engajamento_whatsapp?: EngajamentoWhatsapp | string;
  instagram?: string | null;
  indicacao?: string | null;
  candidato_nome?: string | null;
  candidato_slug?: string | null;
  endereco?: EnderecoPayload | null;
}

export interface ImportarCsvPayload {
  registros: Record<string, string>[];
  /** Quando informado, vincula os contatos importados (e duplicados já existentes) ao evento. */
  evento_id?: number;
}

export type MotivoRegistroNaoImportado = 'nome_duplicado' | 'whatsapp_duplicado';

export interface RegistroNaoImportadoCsv {
  nome: string;
  whatsapp: string | null;
  motivo: MotivoRegistroNaoImportado;
  cadastro_existente?: string | null;
}

export interface ImportarCsvResponse {
  message: string;
  total: number;
  nomes_duplicados?: string[];
  registros_nao_importados?: RegistroNaoImportadoCsv[];
  ids_importados?: number[];
  sem_whatsapp?: number;
  vinculados_evento?: number;
}

export interface DesfazerImportacaoCsvResponse {
  message: string;
  removidos: number;
  ids_removidos?: number[];
}

export interface DesfazerImportacaoRecentesPreview {
  minutos: number;
  total: number;
  nomes_amostra: string[];
  ids: number[];
}

export interface BairroQuantidade {
  bairro: string;
  quantidade: number;
}

export interface DashboardEstatisticas {
  total_cadastros: number;
  bairros: BairroQuantidade[];
}

export interface LinkCadastroContexto {
  candidato: { nome: string; slug: string };
  coordenadores: { id: number; nome: string }[];
  /** Quando a URL pública envia a chave opaca de divulgação, o backend devolve o id do coordenador já validado. */
  preselected_coordenador_id?: number | null;
  evento?: { id: number; nome: string; token_cadastro: string } | null;
}

@Injectable({ providedIn: 'root' })
export class PessoaService {
  private http = inject(HttpClient);
  private apiURL = `${environment.apiUrl}/pessoas`;

  listar(): Observable<PessoaItem[]> {
    return this.http.get<PessoaItem[]>(this.apiURL);
  }

  criar(payload: PessoaPayload): Observable<{ id: number; message: string }> {
    return this.http.post<{ id: number; message: string }>(this.apiURL, payload);
  }

  criarPorLink(slug: string, payload: PessoaPayload): Observable<{ id: number; message: string }> {
    const s = encodeURIComponent(slug.trim().toLowerCase());
    return this.http.post<{ id: number; message: string }>(`${this.apiURL}/link-cadastro/${s}`, payload);
  }

  contextoLinkCadastro(slug: string, queryParams: Record<string, string> = {}): Observable<LinkCadastroContexto> {
    const s = encodeURIComponent(slug.trim().toLowerCase());
    let params = new HttpParams();
    for (const [k, v] of Object.entries(queryParams)) {
      params = params.set(k, v);
    }
    return this.http.get<LinkCadastroContexto>(`${this.apiURL}/link-cadastro/${s}/contexto`, { params });
  }

  atualizar(id: number, payload: PessoaPayload): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiURL}/${id}`, payload);
  }

  excluir(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiURL}/${id}`);
  }

  importarCsv(payload: ImportarCsvPayload): Observable<ImportarCsvResponse> {
    return this.http.post<ImportarCsvResponse>(`${this.apiURL}/importar-csv`, payload);
  }

  desfazerImportacaoCsv(ids: number[]): Observable<DesfazerImportacaoCsvResponse> {
    return this.http.post<DesfazerImportacaoCsvResponse>(`${this.apiURL}/importar-csv/desfazer`, { ids });
  }

  previewDesfazerImportacaoRecentes(minutos = 120): Observable<DesfazerImportacaoRecentesPreview> {
    return this.http.get<DesfazerImportacaoRecentesPreview>(
      `${this.apiURL}/importar-csv/desfazer-recentes/preview`,
      { params: { minutos: String(minutos) } },
    );
  }

  desfazerImportacaoRecentes(minutos = 120): Observable<DesfazerImportacaoCsvResponse> {
    return this.http.post<DesfazerImportacaoCsvResponse>(`${this.apiURL}/importar-csv/desfazer-recentes`, {
      minutos,
    });
  }

  estatisticas(): Observable<DashboardEstatisticas> {
    return this.http.get<DashboardEstatisticas>(`${this.apiURL}/estatisticas`);
  }
}
