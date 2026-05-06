import { Routes } from '@angular/router';
import { canActivateAuthRole } from './autenticacao/auth.guard';
import { AppLayout } from './layout/component/app.layout';
import { AdminDashboardComponent } from './pages/admin/dashboard/admin.dashboard.component';
import { CriarUsuarioComponent } from './pages/criar-usuario/criar-usuario.component';
import { LinkCadastroComponent } from './pages/link-cadastro/link-cadastro.component';
import { ModeloMensagemComponent } from './pages/modelo-mensagem/modelo-mensagem.component';
import { NaoEncontradoComponent } from './pages/nao-encontrado/nao-encontrado.component';
import { PessoaComponent } from './pages/pessoa/pessoa.component';
import { PrincipalComponent } from './pages/principal/principal.component';
import { TermoConsentimentoComponent } from './pages/termo-consentimento/termo-consentimento.component';

export const routes: Routes = [
  {
    path: '',
    component: PrincipalComponent
  },
  {
    path: 'link-cadastro',
    component: LinkCadastroComponent
  },
  {
    path: 'termo-consentimento',
    component: TermoConsentimentoComponent
  },
  {
    path: 'admin',
    component: AppLayout,
    canActivate: [canActivateAuthRole],
    data: { roles: ['Administrador'] },
    children: [
      {
        path: '',
        component: AdminDashboardComponent
      },
      {
        path: 'pessoas',
        component: PessoaComponent
      },
      {
        path: 'modelos-mensagem',
        component: ModeloMensagemComponent
      },
      {
        path: 'criar-usuario',
        component: CriarUsuarioComponent
      }
    ]
  },
  {
    path: 'home',
    component: AppLayout,
    canActivate: [canActivateAuthRole],
    data: { roles: ['Usuario'] },
    children: [
      {
        path: '',
        component: AdminDashboardComponent
      },
      {
        path: 'pessoas',
        component: PessoaComponent
      }
    ]
  },
  {
    path: 'perfil',
    component: AppLayout,
    canActivate: [canActivateAuthRole],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/perfil/meu-perfil.component').then((m) => m.MeuPerfilComponent)
      }
    ]
  },
  {
    path: 'nao-encontrado',
    component: NaoEncontradoComponent
  },
  { path: '**', redirectTo: '/nao-encontrado' }
];
