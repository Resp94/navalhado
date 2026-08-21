import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileBottomSheet } from './MobileBottomSheet';
import { useToast } from '../Toast';
import { supabase } from '../../lib/supabase';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Link01Icon,
  UserGroupIcon,
  ScissorIcon,
  PackageIcon,
  WhatsappIcon,
  Settings02Icon,
  Logout01Icon,
  Copy01Icon,
  Clock01Icon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';

interface MobileMaisDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  managerName: string;
  businessHours?: Record<string, { active: boolean; open: string; close: string }>;
  onLogout: () => void;
}

export const MobileMaisDrawer: React.FC<MobileMaisDrawerProps> = ({
  isOpen,
  onClose,
  tenantId,
  tenantName,
  managerName,
  businessHours,
  onLogout,
}) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [whatsappStatus, setWhatsappStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'loading'>('loading');

  useEffect(() => {
    if (!isOpen || !tenantId) return;

    let isMounted = true;
    const checkWhatsapp = async () => {
      try {
        const { data } = await supabase
          .from('whatsapp_instances')
          .select('status')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (isMounted) {
          if (data?.status === 'connected') {
            setWhatsappStatus('connected');
          } else if (data?.status === 'connecting') {
            setWhatsappStatus('connecting');
          } else {
            setWhatsappStatus('disconnected');
          }
        }
      } catch {
        if (isMounted) setWhatsappStatus('disconnected');
      }
    };

    checkWhatsapp();
    return () => {
      isMounted = false;
    };
  }, [isOpen, tenantId]);

  const handleCopyPublicLink = async () => {
    try {
      const publicUrl = `${window.location.origin}/cliente/agendar?tenant=${tenantId}`;
      await navigator.clipboard.writeText(publicUrl);
      addToast('Link de agendamento copiado com sucesso.', 'success');
    } catch {
      addToast('Não foi possível copiar o link de agendamento.', 'error');
    }
  };

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  // Resumo dos horários
  const activeDaysCount = businessHours
    ? Object.values(businessHours).filter((d) => d.active).length
    : 6;

  return (
    <MobileBottomSheet isOpen={isOpen} onClose={onClose} title="Menu e atalhos" maxHeight="90vh">
      <div className="mobile-mais">
        {/* Card do Usuário / Barbearia */}
        <div className="mobile-mais__profile-card">
          <div className="mobile-mais__profile-avatar">
            {managerName.charAt(0).toUpperCase()}
          </div>
          <div className="mobile-mais__profile-info">
            <span className="mobile-mais__profile-name">{managerName}</span>
            <span className="mobile-mais__profile-role">Gerente • {tenantName}</span>
          </div>
        </div>

        {/* Card de Status Operacional (WhatsApp & Horários) */}
        <div className="mobile-mais__status-overview">
          <div className="mobile-mais__status-item" onClick={() => handleNavigate('/whatsapp')}>
            <div className="mobile-mais__status-item-header">
              <HugeiconsIcon icon={WhatsappIcon} size={16} />
              <span>Robô WhatsApp</span>
            </div>
            <div className="mobile-mais__status-pill">
              <span className={`status-dot dot--${whatsappStatus}`} />
              <span>
                {whatsappStatus === 'connected'
                  ? 'Conectado'
                  : whatsappStatus === 'connecting'
                  ? 'Conectando...'
                  : 'Desconectado'}
              </span>
            </div>
          </div>

          <div className="mobile-mais__status-item" onClick={() => handleNavigate('/configuracoes')}>
            <div className="mobile-mais__status-item-header">
              <HugeiconsIcon icon={Clock01Icon} size={16} />
              <span>Funcionamento</span>
            </div>
            <span className="mobile-mais__status-val">
              {activeDaysCount} dias ativos na semana
            </span>
          </div>
        </div>

        {/* Card do Link de Agendamento do Cliente */}
        <div className="mobile-mais__link-card">
          <div className="mobile-mais__link-header">
            <div className="mobile-mais__link-icon">
              <HugeiconsIcon icon={Link01Icon} size={18} />
            </div>
            <div>
              <span className="mobile-mais__link-title">Link de agendamento online</span>
              <p className="mobile-mais__link-desc">Copie para divulgar no Instagram ou WhatsApp</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleCopyPublicLink}
            className="mobile-mais__link-btn"
          >
            <HugeiconsIcon icon={Copy01Icon} size={16} />
            Copiar link da barbearia
          </button>
        </div>

        {/* Lista de Acessos Operacionais */}
        <div className="mobile-mais__section">
          <span className="mobile-mais__section-title">Gerenciamento</span>

          <div className="mobile-mais__grid">
            <button 
              type="button" 
              className="mobile-mais__item" 
              onClick={() => handleNavigate('/profissionais')}
            >
              <div className="mobile-mais__item-icon">
                <HugeiconsIcon icon={UserGroupIcon} size={20} />
              </div>
              <span className="mobile-mais__item-label">Equipe</span>
            </button>

            <button 
              type="button" 
              className="mobile-mais__item" 
              onClick={() => handleNavigate('/servicos/cadastro')}
            >
              <div className="mobile-mais__item-icon">
                <HugeiconsIcon icon={ScissorIcon} size={20} />
              </div>
              <span className="mobile-mais__item-label">Serviços</span>
            </button>

            <button 
              type="button" 
              className="mobile-mais__item" 
              onClick={() => handleNavigate('/produtos')}
            >
              <div className="mobile-mais__item-icon">
                <HugeiconsIcon icon={PackageIcon} size={20} />
              </div>
              <span className="mobile-mais__item-label">Produtos</span>
            </button>

            <button 
              type="button" 
              className="mobile-mais__item" 
              onClick={() => handleNavigate('/whatsapp')}
            >
              <div className="mobile-mais__item-icon">
                <HugeiconsIcon icon={WhatsappIcon} size={20} />
              </div>
              <span className="mobile-mais__item-label">WhatsApp</span>
            </button>

            <button 
              type="button" 
              className="mobile-mais__item" 
              onClick={() => handleNavigate('/configuracoes')}
            >
              <div className="mobile-mais__item-icon">
                <HugeiconsIcon icon={Settings02Icon} size={20} />
              </div>
              <span className="mobile-mais__item-label">Ajustes</span>
            </button>
          </div>
        </div>

        {/* Botão de Logout */}
        <div className="mobile-mais__footer">
          <button 
            type="button" 
            className="mobile-mais__logout-btn"
            onClick={() => {
              onClose();
              onLogout();
            }}
          >
            <HugeiconsIcon icon={Logout01Icon} size={18} />
            Sair da conta
          </button>
        </div>
      </div>

      <style>{`
        .mobile-mais {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .mobile-mais__profile-card {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 0.875rem 1rem;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg, 12px);
        }

        .mobile-mais__profile-avatar {
          width: 42px;
          height: 42px;
          border-radius: var(--radius-full, 50%);
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
          font-weight: 700;
          font-size: 1.125rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .mobile-mais__profile-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .mobile-mais__profile-name {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .mobile-mais__profile-role {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mobile-mais__status-overview {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .mobile-mais__status-item {
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md, 8px);
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          cursor: pointer;
          transition: border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mobile-mais__status-item:hover {
          border-color: var(--color-brand-primary);
        }

        .mobile-mais__status-item-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-text-secondary);
        }

        .mobile-mais__status-pill {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .dot--connected {
          background: var(--color-success);
          box-shadow: 0 0 6px var(--color-success);
        }

        .dot--connecting {
          background: var(--color-warning);
        }

        .dot--disconnected, .dot--loading {
          background: var(--color-error);
        }

        .mobile-mais__status-val {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .mobile-mais__link-card {
          background: rgba(217, 108, 0, 0.08);
          border: 1px solid rgba(217, 108, 0, 0.25);
          border-radius: var(--radius-lg, 12px);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .mobile-mais__link-header {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .mobile-mais__link-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md, 8px);
          background: rgba(217, 108, 0, 0.15);
          color: var(--color-brand-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .mobile-mais__link-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-brand-primary);
          display: block;
        }

        .mobile-mais__link-desc {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin: 2px 0 0;
        }

        .mobile-mais__link-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
          font-size: 0.8125rem;
          font-weight: 600;
          padding: 0.625rem;
          border-radius: var(--radius-md, 8px);
          border: none;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mobile-mais__link-btn:hover {
          background: var(--color-brand-hover);
        }

        .mobile-mais__link-btn:active {
          transform: scale(0.98);
        }

        .mobile-mais__section {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }

        .mobile-mais__section-title {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          padding-left: 0.25rem;
        }

        .mobile-mais__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.625rem;
        }

        .mobile-mais__item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem 0.5rem;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg, 12px);
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mobile-mais__item:hover {
          border-color: var(--color-brand-primary);
          background: var(--color-bg-secondary);
        }

        .mobile-mais__item:active {
          transform: scale(0.96);
        }

        .mobile-mais__item-icon {
          color: var(--color-brand-primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mobile-mais__item-label {
          font-size: 0.75rem;
          font-weight: 500;
        }

        .mobile-mais__footer {
          margin-top: 0.5rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--color-border);
        }

        .mobile-mais__logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: rgba(240, 82, 82, 0.1);
          border: 1px solid rgba(240, 82, 82, 0.25);
          border-radius: var(--radius-md, 8px);
          color: var(--color-error);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mobile-mais__logout-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </MobileBottomSheet>
  );
};
