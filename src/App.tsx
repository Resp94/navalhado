import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { Login } from './pages/Login';
import { CadastroBarbearia } from './pages/CadastroBarbearia';
import { ResetPassword } from './pages/ResetPassword';
import { AuthGuard } from './components/AuthGuard';
import { Dashboard as AdminDashboard } from './pages/admin/Dashboard';
import { Tenants as AdminTenants } from './pages/admin/Tenants';
import { GerenteLayout } from './components/GerenteLayout';
import { BarbeiroLayout } from './components/BarbeiroLayout';
import { MinhaAgenda } from './pages/barbeiro/MinhaAgenda';
import { MinhasComissoes } from './pages/barbeiro/MinhasComissoes';
import { Dashboard as GerenteDashboard } from './pages/gerente/Dashboard';
import { Financeiro as GerenteFinanceiro } from './pages/gerente/Financeiro';
import { Profissionais as GerenteProfissionais } from './pages/gerente/Profissionais';
import { CadastroAcesso as GerenteCadastroAcesso } from './pages/gerente/CadastroAcesso';
import { Servicos as GerenteServicos } from './pages/gerente/Servicos';
import { Whatsapp as GerenteWhatsapp } from './pages/gerente/Whatsapp';
import { Clientes as GerenteClientes } from './pages/gerente/Clientes';
import { AcessoExpirado } from './pages/cliente/AcessoExpirado';
import { MenuCliente } from './pages/cliente/MenuCliente';
import { FluxoAgendamento } from './pages/cliente/FluxoAgendamento';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Rotas de Autenticação */}
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<CadastroBarbearia />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Rotas Administrativas e do Staff */}
          <Route 
            element={
              <AuthGuard allowedRole="gerente">
                <GerenteLayout />
              </AuthGuard>
            }
          >
            <Route path="/dashboard" element={<GerenteDashboard />} />
            <Route path="/financeiro" element={<GerenteFinanceiro />} />
            <Route path="/profissionais" element={<GerenteProfissionais />} />
            <Route path="/profissionais/cadastro-acesso" element={<GerenteCadastroAcesso />} />
            <Route path="/servicos/cadastro" element={<GerenteServicos />} />
            <Route path="/whatsapp" element={<GerenteWhatsapp />} />
            <Route path="/clientes" element={<GerenteClientes />} />
          </Route>
          {/* Rotas do Barbeiro (Colaborador) */}
          <Route 
            element={
              <AuthGuard allowedRole="barbeiro">
                <BarbeiroLayout />
              </AuthGuard>
            }
          >
            <Route path="/minha-agenda" element={<MinhaAgenda />} />
            <Route path="/minhas-comissoes" element={<MinhasComissoes />} />
          </Route>
          
          {/* Rotas do Proprietário (SaaS Admin) */}
          <Route 
            path="/admin/dashboard" 
            element={
              <AuthGuard allowedRole="proprietario">
                <AdminDashboard />
              </AuthGuard>
            } 
          />
          <Route 
            path="/admin/tenants" 
            element={
              <AuthGuard allowedRole="proprietario">
                <AdminTenants />
              </AuthGuard>
            } 
          />
          
          {/* Rotas do Canal do Cliente */}
          <Route path="/cliente/acesso-expirado" element={<AcessoExpirado />} />
          <Route path="/cliente/menu" element={<MenuCliente />} />
          <Route path="/cliente/agendar" element={<FluxoAgendamento />} />
          <Route path="/cliente/:token" element={<MenuCliente />} />
          <Route path="/cliente/:token/agendar" element={<FluxoAgendamento />} />

          {/* Rota Fallback para erros / 404 */}
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
