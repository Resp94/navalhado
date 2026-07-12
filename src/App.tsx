import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { Login } from './pages/Login';
import { 
  DashboardGerente, 
  AgendaBarbeiro, 
  DashboardSaaSAdmin, 
  CadastroBarbearia 
} from './pages/MockPages';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Rotas de Autenticação */}
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<CadastroBarbearia />} />
          
          {/* Rotas Administrativas e do Staff */}
          <Route path="/dashboard" element={<DashboardGerente />} />
          <Route path="/minha-agenda" element={<AgendaBarbeiro />} />
          <Route path="/admin/dashboard" element={<DashboardSaaSAdmin />} />
          
          {/* Rota Fallback para erros / 404 */}
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
