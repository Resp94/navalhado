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
  PlusSignIcon,
  UnavailableIcon,
} from '@hugeicons/core-free-icons';

interface MobileMaisDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  tenantSlug?: string;
  managerName: string;
  businessHours?: Record<string, { active: boolean; open: string; close: string }>;
  onLogout: () => void;
}

const STATUS_ITEM_CLASS =
  'flex-1 bg-bg-primary border border-border rounded-lg p-3 flex flex-col gap-[0.4rem] cursor-pointer min-h-11 text-left text-text-primary transition-colors duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] touch-manipulation hover:border-brand-primary';

const GRID_ITEM_CLASS =
  'flex flex-col items-center justify-center gap-2 py-4 px-2 bg-bg-primary border border-border rounded-lg text-text-primary cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-brand-primary hover:bg-bg-secondary active:scale-96';

export const MobileMaisDrawer: React.FC<MobileMaisDrawerProps> = ({
  isOpen,
  onClose,
  tenantId,
  tenantName,
  tenantSlug,
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
      const publicUrl = tenantSlug
        ? `${window.location.origin}/${tenantSlug}`
        : `${window.location.origin}/cliente/agendar?tenant=${tenantId}`;
      await navigator.clipboard.writeText(publicUrl);
      addToast('Link de agendamento copiado com sucesso.', 'success');
    } catch {
      addToast('Não foi possível copiar o link de agendamento.', 'error');
    }
  };

  const handleNavigate = (path: string) => {
    onClose();
    if (path.startsWith('/agenda?action=')) {
      const action = path.split('action=')[1].split('&')[0];
      navigate(`/agenda?action=${action}&_t=${Date.now()}`, {
        state: { action, timestamp: Date.now() },
      });
    } else {
      navigate(path);
    }
  };

  // Resumo dos horários
  const activeDaysCount = businessHours
    ? Object.values(businessHours).filter((d) => d.active).length
    : 6;

  const statusDotClass =
    whatsappStatus === 'connected'
      ? 'bg-success shadow-[0_0_6px_var(--color-success)]'
      : whatsappStatus === 'connecting'
        ? 'bg-warning'
        : 'bg-error';

  return (
    <MobileBottomSheet isOpen={isOpen} onClose={onClose} title="Menu e atalhos" maxHeight="90vh">
      <div className="flex flex-col gap-5">
        {/* Card do Usuário / Barbearia */}
        <div className="flex items-center gap-3.5 py-3.5 px-4 bg-bg-primary border border-border rounded-lg">
          <div className="w-[42px] h-[42px] rounded-full bg-brand-primary text-brand-lightest font-bold text-lg flex items-center justify-center shrink-0">
            {managerName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[0.9375rem] font-semibold text-text-primary">{managerName}</span>
            <span className="text-xs text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis">Gerente • {tenantName}</span>
          </div>
        </div>

        {/* Card de Status Operacional (WhatsApp & Horários) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={STATUS_ITEM_CLASS}
            onClick={() => handleNavigate('/whatsapp')}
            aria-label={`Robô WhatsApp: ${whatsappStatus === 'connected' ? 'Conectado' : whatsappStatus === 'connecting' ? 'Conectando' : 'Desconectado'}. Clique para gerenciar.`}
          >
            <div className="flex items-center gap-[0.4rem] text-[0.6875rem] font-bold uppercase text-text-secondary">
              <HugeiconsIcon icon={WhatsappIcon} size={16} />
              <span>Robô WhatsApp</span>
            </div>
            <div className="flex items-center gap-[0.35rem] text-xs font-semibold text-text-primary">
              <span className={`w-[7px] h-[7px] rounded-full ${statusDotClass}`} />
              <span>
                {whatsappStatus === 'connected'
                  ? 'Conectado'
                  : whatsappStatus === 'connecting'
                  ? 'Conectando...'
                  : 'Desconectado'}
              </span>
            </div>
          </button>

          <button
            type="button"
            className={STATUS_ITEM_CLASS}
            onClick={() => handleNavigate('/configuracoes')}
            aria-label={`Funcionamento: ${activeDaysCount} dias ativos na semana. Clique para ajustar.`}
          >
            <div className="flex items-center gap-[0.4rem] text-[0.6875rem] font-bold uppercase text-text-secondary">
              <HugeiconsIcon icon={Clock01Icon} size={16} />
              <span>Funcionamento</span>
            </div>
            <span className="text-xs font-semibold text-text-primary">
              {activeDaysCount} dias ativos na semana
            </span>
          </button>
        </div>

        {/* Card do Link de Agendamento do Cliente */}
        <div className="bg-[rgba(217,108,0,0.08)] border border-[rgba(217,108,0,0.25)] rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-[rgba(217,108,0,0.15)] text-brand-primary flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={Link01Icon} size={18} />
            </div>
            <div>
              <span className="text-sm font-semibold text-brand-primary block">Link de agendamento online</span>
              <p className="text-xs text-text-secondary m-0 mt-0.5">Copie para divulgar no Instagram ou WhatsApp</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyPublicLink}
            className="flex items-center justify-center gap-2 bg-brand-primary text-brand-lightest text-[0.8125rem] font-semibold py-2.5 rounded-md border-none cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-brand-hover active:scale-98"
          >
            <HugeiconsIcon icon={Copy01Icon} size={16} />
            Copiar link da barbearia
          </button>
        </div>

        {/* Lista de Acessos Operacionais */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-[0.05em] text-text-secondary pl-1">Gerenciamento</span>

          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              className={GRID_ITEM_CLASS}
              onClick={() => handleNavigate('/agenda?action=encaixe')}
            >
              <div className="text-brand-primary flex items-center justify-center">
                <HugeiconsIcon icon={PlusSignIcon} size={20} />
              </div>
              <span className="text-xs font-medium">Encaixe</span>
            </button>

            <button
              type="button"
              className={GRID_ITEM_CLASS}
              onClick={() => handleNavigate('/agenda?action=bloqueio')}
            >
              <div className="text-brand-primary flex items-center justify-center">
                <HugeiconsIcon icon={UnavailableIcon} size={20} />
              </div>
              <span className="text-xs font-medium">Bloquear</span>
            </button>

            <button
              type="button"
              className={GRID_ITEM_CLASS}
              onClick={() => handleNavigate('/agenda?action=espera')}
            >
              <div className="text-brand-primary flex items-center justify-center">
                <HugeiconsIcon icon={UserGroupIcon} size={20} />
              </div>
              <span className="text-xs font-medium">Espera</span>
            </button>

            <button
              type="button"
              className={GRID_ITEM_CLASS}
              onClick={() => handleNavigate('/profissionais')}
            >
              <div className="text-brand-primary flex items-center justify-center">
                <HugeiconsIcon icon={UserGroupIcon} size={20} />
              </div>
              <span className="text-xs font-medium">Equipe</span>
            </button>

            <button
              type="button"
              className={GRID_ITEM_CLASS}
              onClick={() => handleNavigate('/servicos/cadastro')}
            >
              <div className="text-brand-primary flex items-center justify-center">
                <HugeiconsIcon icon={ScissorIcon} size={20} />
              </div>
              <span className="text-xs font-medium">Serviços</span>
            </button>

            <button
              type="button"
              className={GRID_ITEM_CLASS}
              onClick={() => handleNavigate('/produtos')}
            >
              <div className="text-brand-primary flex items-center justify-center">
                <HugeiconsIcon icon={PackageIcon} size={20} />
              </div>
              <span className="text-xs font-medium">Produtos</span>
            </button>

            <button
              type="button"
              className={GRID_ITEM_CLASS}
              onClick={() => handleNavigate('/whatsapp')}
            >
              <div className="text-brand-primary flex items-center justify-center">
                <HugeiconsIcon icon={WhatsappIcon} size={20} />
              </div>
              <span className="text-xs font-medium">WhatsApp</span>
            </button>

            <button
              type="button"
              className={GRID_ITEM_CLASS}
              onClick={() => handleNavigate('/configuracoes')}
            >
              <div className="text-brand-primary flex items-center justify-center">
                <HugeiconsIcon icon={Settings02Icon} size={20} />
              </div>
              <span className="text-xs font-medium">Ajustes</span>
            </button>
          </div>
        </div>

        {/* Botão de Logout */}
        <div className="mt-2 pt-3 border-t border-border">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 py-3 bg-[rgba(240,82,82,0.1)] border border-[rgba(240,82,82,0.25)] rounded-md text-error text-sm font-semibold cursor-pointer transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-98"
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
    </MobileBottomSheet>
  );
};
