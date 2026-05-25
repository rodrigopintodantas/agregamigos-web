import { Routes } from '@angular/router';
import { canActivateAuthRole } from './autenticacao/auth.guard';
import { canActivateCandidatoSlug } from './autenticacao/candidato-slug.guard';
import { canActivateUsuarioLogado } from './autenticacao/usuario-logado.guard';
import { AppLayout } from './layout/component/app.layout';
import { AdminDashboardComponent } from './pages/admin/dashboard/admin.dashboard.component';
import { CriarUsuarioComponent } from './pages/criar-usuario/criar-usuario.component';
import { DivulgacaoComponent } from './pages/divulgacao/divulgacao.component';
import { LinkCadastroComponent } from './pages/link-cadastro/link-cadastro.component';
import { ModeloMensagemComponent } from './pages/modelo-mensagem/modelo-mensagem.component';
import { NaoEncontradoComponent } from './pages/nao-encontrado/nao-encontrado.component';
import { PessoaComponent } from './pages/pessoa/pessoa.component';
import { PrincipalComponent } from './pages/principal/principal.component';
import { TermoConsentimentoComponent } from './pages/termo-consentimento/termo-consentimento.component';
import { VotacaoComponent } from './pages/votacao/votacao.component';
import { OuvidoriaComponent } from './pages/ouvidoria/ouvidoria.component';
import { WhatsappComponent } from './pages/whatsapp/whatsapp.component';
import { PainelCampanhasComponent } from './pages/painel-campanhas/painel-campanhas.component';

export const routes: Routes = [
  {
    path: '',
    component: PrincipalComponent,
  },
  {
    path: 'nao-encontrado',
    component: NaoEncontradoComponent,
  },
  {
    path: 'selecionar-candidato',
    canActivate: [canActivateUsuarioLogado],
    loadComponent: () =>
      import('./pages/selecionar-candidato/selecionar-candidato.component').then(
        (m) => m.SelecionarCandidatoComponent,
      ),
  },
  {
    path: ':candidatoSlug/link-cadastro',
    component: LinkCadastroComponent,
  },
  {
    path: ':candidatoSlug/termo-consentimento',
    component: TermoConsentimentoComponent,
  },
  {
    path: ':candidatoSlug/admin',
    component: AppLayout,
    canActivate: [canActivateAuthRole, canActivateCandidatoSlug],
    data: { roles: ['Administrador'] },
    children: [
      {
        path: '',
        component: AdminDashboardComponent,
      },
      {
        path: 'pessoas',
        component: PessoaComponent,
      },
      {
        path: 'modelos-mensagem',
        component: ModeloMensagemComponent,
      },
      {
        path: 'criar-usuario',
        component: CriarUsuarioComponent,
      },
      {
        path: 'divulgacao',
        component: DivulgacaoComponent,
      },
      {
        path: 'painel-campanhas',
        component: PainelCampanhasComponent,
      },
      {
        path: 'whatsapp',
        component: WhatsappComponent,
      },
      {
        path: 'votacao',
        component: VotacaoComponent,
      },
      {
        path: 'ouvidoria',
        component: OuvidoriaComponent,
      },
    ],
  },
  {
    path: ':candidatoSlug/home',
    component: AppLayout,
    canActivate: [canActivateAuthRole, canActivateCandidatoSlug],
    data: { roles: ['Usuario'] },
    children: [
      {
        path: '',
        component: AdminDashboardComponent,
      },
      {
        path: 'pessoas',
        component: PessoaComponent,
      },
    ],
  },
  {
    path: ':candidatoSlug/coordenador',
    component: AppLayout,
    canActivate: [canActivateAuthRole, canActivateCandidatoSlug],
    data: { roles: ['Coordenador'] },
    children: [
      {
        path: '',
        component: AdminDashboardComponent,
      },
      {
        path: 'pessoas',
        component: PessoaComponent,
      },
    ],
  },
  {
    path: ':candidatoSlug/perfil',
    component: AppLayout,
    canActivate: [canActivateUsuarioLogado, canActivateCandidatoSlug],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/perfil/meu-perfil.component').then((m) => m.MeuPerfilComponent),
      },
    ],
  },
  {
    path: 'admin',
    redirectTo: 'selecionar-candidato',
    pathMatch: 'prefix',
  },
  {
    path: 'home',
    redirectTo: 'selecionar-candidato',
    pathMatch: 'prefix',
  },
  {
    path: 'perfil',
    redirectTo: 'selecionar-candidato',
    pathMatch: 'full',
  },
  { path: '**', redirectTo: '/nao-encontrado' },
];
