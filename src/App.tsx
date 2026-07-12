import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { Login } from './pages/Login';
import { CadastroBarbearia } from './pages/CadastroBarbearia';
import { ResetPassword } from './pages/ResetPassword';
import { AuthGuard } from './components/AuthGuard';
import { Dashboard as AdminDashboard } from './pages/admin/Dashboard';
import { Tenants as AdminTenants } from './pages/admin/Tenants';
import { 
  DashboardGerente, 
  AgendaBarbeiro
} from './pages/MockPages';

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
            path="/dashboard" 
            element={
              <AuthGuard allowedRole="gerente">
                <DashboardGerente />
              </AuthGuard>
            } 
          />
          <Route 
            path="/minha-agenda" 
            element={
              <AuthGuard allowedRole="barbeiro">
                <AgendaBarbeiro />
              </AuthGuard>
            } 
          />
          
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
          
          {/* Rota Fallback para erros / 404 */}
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
