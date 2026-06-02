import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type CampanhaStatus = 'rascunho' | 'montada' | 'em_andamento' | 'finalizada' | 'cancelada';

export interface WhatsappCanalResumo {
  id: number;
  nome: string;
  numero: string | null;
  status: string;
}

export interface CampanhaDivulgacaoItem {
  id: number;
  nome: string;
  status: CampanhaStatus;
  mensagens_por_turno: number;
  whatsapp_canal_id?: number | null;
  whatsapp_canal?: WhatsappCanalResumo | null;
  total_destinatarios: number;
  total_enviados: number;
  total_pendentes: number;
  total_cancelados?: number;
  total_erros?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CriarCampanhaPayload {
  nome: string;
  pessoa_ids: number[];
  modelo_ids: number[];
  mensagens_por_turno: number;
  whatsapp_canal_id: number;
}

export interface CriarCampanhaResponse {
  id: number;
  message: string;
  status: CampanhaStatus;
  mensagens_por_turno: number;
  total_destinatarios: number;
}

export interface ExcluirCampanhaResponse {
  message: string;
}

export interface AcaoCampanhaResponse {
  id: number;
  status: CampanhaStatus;
  message: string;
}

export type RespostaSentimento = 'positivo' | 'negativo' | 'neutro' | 'desconhecido';

export type EngajamentoPainel = 'sem_resposta' | 'positivo' | 'negativo' | 'neutro';

export interface PainelEngajamentoContagem {
  sem_resposta: number;
  positivo: number;
  negativo: number;
  neutro: number;
  total: number;
}

export interface PainelCampanhaResumo {
  id: number;
  nome: string;
  status: CampanhaStatus | string;
  total_destinatarios: number;
  total_enviados: number;
  createdAt: string;
  updatedAt: string;
  respostas: {
    com_resposta: number;
    sem_resposta: number;
    positivo: number;
    negativo: number;
    neutro: number;
  };
}

export interface PainelCampanhasResponse {
  totais: {
    pessoas_cadastradas: number;
    campanhas: number;
    campanhas_realizadas: number;
  };
  engajamento: PainelEngajamentoContagem;
  campanhas: PainelCampanhaResumo[];
}

export interface PainelCampanhaPessoaItem {
  id: number;
  nome: string;
  whatsapp: string | null;
  engajamento_whatsapp: string;
  bairro?: string | null;
  erro_whatsapp?: boolean;
  destinatario_id?: number | null;
  campanha_id?: number | null;
  enviado_em?: string | null;
  mensagem?: string | null;
  mensagem_tipo?: 'envio' | 'resposta' | null;
}

export interface PainelCampanhasPessoasResponse {
  filtro: 'engajamento' | 'campanha_sem_resposta' | 'campanha_enviados';
  engajamento: EngajamentoPainel | null;
  campanha_id: number | null;
  campanha_nome: string | null;
  total: number;
  page?: number;
  limit?: number;
  pessoas: PainelCampanhaPessoaItem[];
}

export interface CampanhaDestinatarioDetalhe {
  id: number;
  ordem: number;
  status: string;
  turno: 'manha' | 'tarde' | 'noite' | null;
  agendado_para: string | null;
  tentativas: number;
  enviado_em: string | null;
  erro_ultimo: string | null;
  wa_message_id_envio?: string | null;
  resposta_1_texto?: string | null;
  resposta_1_em?: string | null;
  resposta_1_sentimento?: RespostaSentimento | string | null;
  resposta_2_texto?: string | null;
  resposta_2_em?: string | null;
  resposta_2_sentimento?: RespostaSentimento | string | null;
  pessoa: {
    id: number;
    nome: string;
    whatsapp: string | null;
    bairro?: string | null;
    nome_coordenador?: string | null;
  } | null;
  modelo: {
    id: number;
    titulo: string;
    corpo?: string | null;
  } | null;
}

export interface CampanhaDivulgacaoDetalhe {
  id: number;
  nome: string;
  status: CampanhaStatus;
  mensagens_por_turno: number;
  whatsapp_canal_id?: number | null;
  whatsapp_canal?: WhatsappCanalResumo | null;
  total_destinatarios: number;
  total_enviados: number;
  createdAt: string;
  updatedAt: string;
  destinatarios: CampanhaDestinatarioDetalhe[];
}

function pickCampo(o: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined && o[k] !== null) {
      return o[k];
    }
  }
  return undefined;
}

/** Garante chaves esperadas pelo front, mesmo se o JSON vier só em camelCase ou só em snake_case. */
function normalizarDestinatarioDetalheApi(raw: Record<string, unknown>): CampanhaDestinatarioDetalhe {
  const d = { ...raw } as CampanhaDestinatarioDetalhe & Record<string, unknown>;
  d.resposta_1_texto = (pickCampo(raw, 'resposta_1_texto', 'resposta1Texto') as string | null | undefined) ?? null;
  d.resposta_1_em = (pickCampo(raw, 'resposta_1_em', 'resposta1Em') as string | null | undefined) ?? null;
  d.resposta_1_sentimento =
    (pickCampo(raw, 'resposta_1_sentimento', 'resposta1Sentimento') as string | null | undefined) ?? null;
  d.resposta_2_texto = (pickCampo(raw, 'resposta_2_texto', 'resposta2Texto') as string | null | undefined) ?? null;
  d.resposta_2_em = (pickCampo(raw, 'resposta_2_em', 'resposta2Em') as string | null | undefined) ?? null;
  d.resposta_2_sentimento =
    (pickCampo(raw, 'resposta_2_sentimento', 'resposta2Sentimento') as string | null | undefined) ?? null;
  d.wa_message_id_envio =
    (pickCampo(raw, 'wa_message_id_envio', 'waMessageIdEnvio') as string | null | undefined) ?? null;
  return d as CampanhaDestinatarioDetalhe;
}

function normalizarDetalheCampanhaApi(body: CampanhaDivulgacaoDetalhe): CampanhaDivulgacaoDetalhe {
  const rawList = (body as unknown as { destinatarios?: unknown[] }).destinatarios ?? [];
  return {
    ...body,
    destinatarios: rawList
      .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object')
      .map((x) => normalizarDestinatarioDetalheApi(x)),
  };
}

@Injectable({ providedIn: 'root' })
export class CampanhaDivulgacaoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/campanhas-divulgacao`;

  painel(): Observable<PainelCampanhasResponse> {
    return this.http.get<PainelCampanhasResponse>(`${this.base}/painel`);
  }

  painelPessoas(params: {
    engajamento?: EngajamentoPainel | null;
    campanha_id?: number | null;
    filtro?: 'engajamento' | 'campanha_sem_resposta' | 'campanha_enviados';
    page?: number;
    limit?: number;
  }): Observable<PainelCampanhasPessoasResponse> {
    let httpParams = new HttpParams();
    if (params.filtro) httpParams = httpParams.set('filtro', params.filtro);
    if (params.engajamento) httpParams = httpParams.set('engajamento', params.engajamento);
    if (params.campanha_id != null && params.campanha_id > 0) {
      httpParams = httpParams.set('campanha_id', String(params.campanha_id));
    }
    if (params.page != null && params.page > 0) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.limit != null && params.limit > 0) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<PainelCampanhasPessoasResponse>(`${this.base}/painel/pessoas`, { params: httpParams });
  }

  atualizarEngajamentoDestinatarioPainel(body: {
    destinatario_id: number;
    engajamento: EngajamentoPainel;
  }): Observable<{ pessoa: PainelCampanhaPessoaItem }> {
    return this.http.patch<{ pessoa: PainelCampanhaPessoaItem }>(
      `${this.base}/painel/destinatario-engajamento`,
      body,
    );
  }

  private noCacheHeaders = new HttpHeaders({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
  });

  listar(): Observable<CampanhaDivulgacaoItem[]> {
    return this.http.get<CampanhaDivulgacaoItem[]>(this.base);
  }

  criar(payload: CriarCampanhaPayload): Observable<CriarCampanhaResponse> {
    return this.http.post<CriarCampanhaResponse>(this.base, payload);
  }

  detalhe(id: number): Observable<CampanhaDivulgacaoDetalhe> {
    return this.http
      .get<CampanhaDivulgacaoDetalhe>(`${this.base}/${id}`, { headers: this.noCacheHeaders })
      .pipe(map((body) => normalizarDetalheCampanhaApi(body)));
  }

  excluir(id: number): Observable<ExcluirCampanhaResponse> {
    return this.http.delete<ExcluirCampanhaResponse>(`${this.base}/${id}`);
  }

  iniciar(
    id: number,
    payload: { modo?: 'agora' | 'agendar'; agendado_para?: string } = { modo: 'agora' },
  ): Observable<AcaoCampanhaResponse> {
    return this.http.post<AcaoCampanhaResponse>(`${this.base}/${id}/iniciar`, payload);
  }

  reiniciar(
    id: number,
    payload: { modo?: 'agora' | 'agendar'; agendado_para?: string } = { modo: 'agora' },
  ): Observable<AcaoCampanhaResponse> {
    return this.http.post<AcaoCampanhaResponse>(`${this.base}/${id}/reiniciar`, payload);
  }

  reprocessarErros(id: number): Observable<AcaoCampanhaResponse> {
    return this.http.post<AcaoCampanhaResponse>(`${this.base}/${id}/reprocessar-erros`, {});
  }

  cancelar(id: number): Observable<AcaoCampanhaResponse> {
    return this.http.post<AcaoCampanhaResponse>(`${this.base}/${id}/cancelar`, {});
  }
}
