import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WhatsappStatus {
  conectado: boolean;
  status: 'conectado' | 'desconectado' | 'conectando' | 'aguardando_qr' | 'reconectando' | string;
  numero: string | null;
  nomePerfil: string | null;
  qrCode: string | null;
  ultimaAtualizacao: string;
}

export interface WhatsappConectarPayload {
  nomePerfil?: string;
}

export interface WhatsappAcaoResponse extends WhatsappStatus {
  message: string;
}

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/whatsapp`;

  status(): Observable<WhatsappStatus> {
    return this.http.get<WhatsappStatus>(`${this.base}/status`);
  }

  conectar(payload: WhatsappConectarPayload): Observable<WhatsappAcaoResponse> {
    return this.http.post<WhatsappAcaoResponse>(`${this.base}/conectar`, payload);
  }

  desconectar(): Observable<WhatsappAcaoResponse> {
    return this.http.post<WhatsappAcaoResponse>(`${this.base}/desconectar`, {});
  }
}
