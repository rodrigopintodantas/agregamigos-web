import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WhatsappCanal {
  id: number;
  nome: string;
  numero: string | null;
  status: string;
  conectado?: boolean;
  qrCode?: string | null;
  nomePerfil?: string | null;
  ultimaAtualizacao?: string;
  candidato_id?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WhatsappConectarPayload {
  nomePerfil?: string;
}

export interface WhatsappAcaoResponse extends WhatsappCanal {
  message: string;
}

export interface CriarWhatsappCanalPayload {
  nome: string;
}

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/whatsapp`;

  listarCanais(): Observable<WhatsappCanal[]> {
    return this.http.get<WhatsappCanal[]>(`${this.base}/canais`);
  }

  criarCanal(payload: CriarWhatsappCanalPayload): Observable<WhatsappAcaoResponse> {
    return this.http.post<WhatsappAcaoResponse>(`${this.base}/canais`, payload);
  }

  statusCanal(canalId: number): Observable<WhatsappCanal> {
    return this.http.get<WhatsappCanal>(`${this.base}/canais/${canalId}/status`);
  }

  conectarCanal(canalId: number, payload?: WhatsappConectarPayload): Observable<WhatsappAcaoResponse> {
    return this.http.post<WhatsappAcaoResponse>(`${this.base}/canais/${canalId}/conectar`, payload ?? {});
  }

  desconectarCanal(canalId: number): Observable<WhatsappAcaoResponse> {
    return this.http.post<WhatsappAcaoResponse>(`${this.base}/canais/${canalId}/desconectar`, {});
  }

  trocarTelefoneCanal(canalId: number, payload?: WhatsappConectarPayload): Observable<WhatsappAcaoResponse> {
    return this.http.post<WhatsappAcaoResponse>(`${this.base}/canais/${canalId}/trocar-telefone`, payload ?? {});
  }
}
