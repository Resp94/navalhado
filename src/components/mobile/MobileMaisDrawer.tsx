import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileBottomSheet } from './MobileBottomSheet';
import { useToast } from '../Toast';
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
} from '@hugeicons/core-free-icons';

interface MobileMaisDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  managerName: string;
  onLogout: () => void;
}

export const MobileMaisDrawer: React.FC<MobileMaisDrawerProps> = ({
  isOpen,
  onClose,
  tenantId,
  tenantName,
  managerName,
  onLogout,
}) => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleCopyPublicLink = async () => {
    try {
      const publicUrl = `${window.location.origin}/cliente/agendar?tenant=${tenantId}`;
      await navigator.clipboard.writeText(publicUrl);
      addToast('Link de agendamento copiado para a área de transferência!', 'success');
    } catch {
      addToast('Erro ao copiar link.', 'error');
    }
  };

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <MobileBottomSheet isOpen={isOpen} onClose={onClose} title="Menu & Atalhos" maxHeight="90vh">
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

        {/* Card do Link de Agendamento do Cliente */}
        <div className="mobile-mais__link-card">
          <div className="mobile-mais__link-header">
            <div className="mobile-mais__link-icon">
              <HugeiconsIcon icon={Link01Icon} size={18} />
            </div>
            <div>
              <span className="mobile-mais__link-title">Link de Agendamento Online</span>
              <p className="mobile-mais__link-desc">Copie para divulgar no Instagram ou WhatsApp</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleCopyPublicLink}
            className="mobile-mais__link-btn"
          >
            <HugeiconsIcon icon={Copy01Icon} size={16} />
            Copiar Link da Barbearia
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
            Sair da Conta
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
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
        }

        .mobile-mais__profile-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #18181b;
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
          color: #f4f4f5;
        }

        .mobile-mais__profile-role {
          font-size: 0.75rem;
          color: #a1a1aa;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mobile-mais__link-card {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.04) 100%);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 12px;
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
          border-radius: 8px;
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .mobile-mais__link-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #f59e0b;
          display: block;
        }

        .mobile-mais__link-desc {
          font-size: 0.75rem;
          color: #d4d4d8;
          margin: 2px 0 0;
        }

        .mobile-mais__link-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: #f59e0b;
          color: #18181b;
          font-size: 0.8125rem;
          font-weight: 600;
          padding: 0.625rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
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
          color: #71717a;
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
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          color: #e4e4e7;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mobile-mais__item:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .mobile-mais__item:active {
          transform: scale(0.96);
        }

        .mobile-mais__item-icon {
          color: #f59e0b;
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
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .mobile-mais__logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 10px;
          color: #ef4444;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mobile-mais__logout-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </MobileBottomSheet>
  );
};
