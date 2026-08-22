import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { EyeIcon, EyeOffIcon, LockIcon } from '../../components/Icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';

interface Professional {
  id: string;
  name: string;
  phone: string;
  user_id: string | null;
}

export const CadastroAcesso: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Campos do formulário
  const [selectedProfId, setSelectedProfId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fetchUnlinkedProfessionals = async () => {
      try {
        setLoading(true);
        // Buscar apenas os profissionais da barbearia que ainda NÃO têm conta de login vinculada
        const { data, error } = await supabase
          .from('professionals')
          .select('id, name, phone, user_id')
          .eq('tenant_id', tenant.tenantId)
          .is('user_id', null)
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (error) throw error;
        setProfessionals(data || []);
      } catch (error: any) {
        addToast('Erro ao carregar a lista de profissionais sem acesso.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchUnlinkedProfessionals();
  }, [tenant.tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProfId) {
      addToast('Selecione um profissional para vincular o acesso.', 'warning');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      addToast('Informe um e-mail válido.', 'warning');
      return;
    }
    if (password.length < 8) {
      addToast('A senha deve ter pelo menos 8 caracteres.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      
      const selectedProf = professionals.find(p => p.id === selectedProfId);
      
      // 1. Invocar a Edge Function do Supabase para criar a credencial na tabela auth.users com service_role
      const { error } = await supabase.functions.invoke('create-barber-access', {
        body: {
          email: email.trim(),
          password: password,
          name: selectedProf?.name,
          professionalId: selectedProfId,
          tenantId: tenant.tenantId
        }
      });

      if (error) {
        throw error;
      }

      addToast(`Acesso criado com sucesso para o profissional ${selectedProf?.name}!`, 'success');

      // Redireciona de volta para a lista de equipe
      navigate('/profissionais');

    } catch (error: any) {
      console.error('Error creating barber access:', error);
      addToast(error.message || 'Não foi possível configurar as credenciais.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="access-page">
      <header className="access-header">
        <button 
          type="button"
          onClick={() => navigate('/profissionais')} 
          className="btn-back"
          aria-label="Voltar para a página de equipe"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} aria-hidden="true" />
          <span>Voltar para equipe</span>
        </button>
        <h2>Configurar credenciais de acesso</h2>
        <p>
          Crie o login e senha para que o barbeiro consiga acessar sua própria agenda e comissões no sistema.
        </p>
      </header>

      <div className="access-container card">
        {loading ? (
          <div className="loading-state">
            <div 
              className="spinner" 
              style={{ borderColor: 'var(--color-brand-primary)', borderTopColor: 'transparent' }} 
            />
            <p>Carregando profissionais disponíveis...</p>
          </div>
        ) : professionals.length === 0 ? (
          <div className="empty-state">
            <h4>Toda a equipe já possui login configurado</h4>
            <p>Se precisar alterar as credenciais de alguém, edite diretamente o cadastro do profissional na página de equipe.</p>
            <button 
              type="button"
              onClick={() => navigate('/profissionais')} 
              className="btn btn--primary" 
              style={{ marginTop: '1rem' }}
            >
              Voltar para equipe
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="access-form">
            <div className="form-group">
              <label htmlFor="select-prof">Selecione o barbeiro</label>
              <select 
                id="select-prof"
                value={selectedProfId}
                onChange={(e) => setSelectedProfId(e.target.value)}
                required
              >
                <option value="">Selecione o profissional...</option>
                {professionals.map((prof) => (
                  <option key={prof.id} value={prof.id}>{prof.name} ({prof.phone})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="input-email">E-mail de login</label>
              <input 
                id="input-email"
                type="email" 
                placeholder="Ex: joao@barbearianavalhado.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby="email-helper"
                required
              />
              <span id="email-helper" className="input-helper">
                Este e-mail será utilizado pelo barbeiro para fazer login na área do colaborador
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="input-password">Senha de acesso</label>
              <div className="password-input-wrapper">
                <input 
                  id="input-password"
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="Mínimo de 8 caracteres" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="btn-toggle-password"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  aria-controls="input-password"
                >
                  {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
                </button>
              </div>
            </div>

            <div className="security-notice" role="note">
              <div className="security-notice-icon">
                <LockIcon size={18} aria-hidden="true" />
              </div>
              <div className="security-notice-content">
                <strong>Acesso seguro e restrito:</strong>
                <span>O profissional terá acesso apenas à visualização da sua própria agenda e relatório de comissões, sem permissão para visualizar dados financeiros gerais ou alterar configurações da barbearia.</span>
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                onClick={() => navigate('/profissionais')} 
                className="btn btn--outline-secondary"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? <div className="spinner spinner--sm" /> : 'Confirmar e criar acesso'}
              </button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        .access-page {
          max-width: 600px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .access-header {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
        }

        .btn-back {
          background: none;
          border: none;
          color: var(--color-brand-primary);
          font-size: var(--font-size-sm);
          font-weight: 700;
          cursor: pointer;
          padding: 0.35rem 0;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 0.5rem;
          transition: transform 0.2s ease, color 0.2s ease;
        }

        .btn-back:hover {
          color: var(--color-brand-hover);
          transform: translateX(-3px);
        }

        .btn-back:focus-visible {
          outline: 2px solid var(--color-brand-primary);
          outline-offset: 2px;
          border-radius: var(--radius-sm);
        }

        .access-header h2 {
          font-size: var(--font-size-2xl);
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
          margin: 0;
        }

        .access-header p {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          line-height: 1.5;
          margin: 0;
        }

        .card {
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 2rem;
          box-shadow: var(--shadow-sm);
        }

        .access-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-group label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .form-group input,
        .form-group select {
          padding: 0.75rem 1rem;
          min-height: 44px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
          width: 100%;
        }

        .form-group input:focus,
        .form-group select:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
          background-color: var(--color-bg-secondary);
        }

        .password-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .password-input-wrapper input {
          padding-right: 3.25rem !important;
        }

        .btn-toggle-password {
          position: absolute;
          right: 0.25rem;
          min-width: 44px;
          min-height: 44px;
          background: none;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
          transition: color 0.2s ease, background-color 0.2s ease;
        }

        .btn-toggle-password:hover {
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-deep);
        }

        .btn-toggle-password:focus-visible {
          outline: 2px solid var(--color-brand-primary);
          outline-offset: -2px;
        }

        .input-helper {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin-top: 0.15rem;
          line-height: 1.4;
        }

        .security-notice {
          background-color: var(--color-brand-lightest);
          border: 1px solid rgba(217, 108, 0, 0.25);
          border-radius: var(--radius-md);
          padding: 0.875rem 1rem;
          font-size: var(--font-size-xs);
          color: var(--color-brand-deep);
          line-height: 1.45;
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
        }

        .security-notice-icon {
          flex-shrink: 0;
          margin-top: 0.1rem;
          color: var(--color-brand-deep);
        }

        .security-notice-content {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          border-top: 1px solid var(--color-border);
          padding-top: 1.25rem;
          margin-top: 0.5rem;
          flex-wrap: wrap;
        }

        .btn--outline-secondary {
          background-color: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          border-radius: var(--radius-md);
          padding: 0.75rem 1.25rem;
          font-weight: 600;
        }

        .btn--outline-secondary:hover {
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
          border-color: var(--color-brand-soft);
        }

        .loading-state,
        .empty-state {
          padding: 3rem 1.5rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          color: var(--color-text-secondary);
        }

        .empty-state h4 {
          font-size: var(--font-size-lg);
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
        }

        .empty-state p {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          max-width: 38ch;
          line-height: 1.4;
          margin: 0;
        }
      `}</style>
    </div>
  );
};
