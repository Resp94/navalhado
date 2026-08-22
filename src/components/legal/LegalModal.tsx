import React from 'react';
import { Modal } from '../Modal';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'privacy' | 'terms';
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, mode }) => {
  const isPrivacy = mode === 'privacy';
  const title = isPrivacy ? 'Política de Privacidade (LGPD)' : 'Termos de Uso e Serviço';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="legal-content" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem', fontSize: '0.875rem', lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>
        {isPrivacy ? (
          <div>
            <h4 style={{ color: 'var(--color-text-primary)', marginTop: 0 }}>1. Coleta e Finalidade dos Dados</h4>
            <p>
              O sistema <strong>Navalhado</strong> coleta exclusivamente os dados estritamente necessários para a operacionalização dos agendamentos e atendimento em barbearias, incluindo: nome, telefone celular (para envio de lembretes e confirmações via WhatsApp) e e-mail.
            </p>

            <h4 style={{ color: 'var(--color-text-primary)' }}>2. Base Legal (LGPD - Lei nº 13.709/2018)</h4>
            <p>
              O tratamento de dados pessoais é fundamentado no <strong>Artigo 7º, Inciso V</strong> da LGPD (execução de contrato e procedimentos preliminares a pedido do titular) e legítimo interesse para a gestão do fluxo operacional da barbearia.
            </p>

            <h4 style={{ color: 'var(--color-text-primary)' }}>3. Direitos do Titular (Art. 18 da LGPD)</h4>
            <p>
              O titular tem o direito de solicitar a qualquer momento a confirmação de tratamento, acesso aos seus dados, correção de informações incompletas ou a anonimização/eliminação dos seus registros através do contato direto com o estabelecimento responsável ou suporte.
            </p>

            <h4 style={{ color: 'var(--color-text-primary)' }}>4. Segurança e Criptografia</h4>
            <p>
              Todos os dados trafegam exclusivamente sobre conexões criptografadas de ponta a ponta (HTTPS/TLS 1.3) e são armazenados em infraestrutura de banco de dados com criptografia em repouso (AES-256) e isolamento multi-tenant por Row Level Security (RLS).
            </p>
          </div>
        ) : (
          <div>
            <h4 style={{ color: 'var(--color-text-primary)', marginTop: 0 }}>1. Aceite dos Termos</h4>
            <p>
              Ao utilizar a plataforma <strong>Navalhado</strong>, você concorda em cumprir estes termos e todas as leis e regulamentações aplicáveis à prestação e agendamento de serviços.
            </p>

            <h4 style={{ color: 'var(--color-text-primary)' }}>2. Uso da Conta e Responsabilidades</h4>
            <p>
              Gestores e profissionais são responsáveis por manter a confidencialidade de suas credenciais de acesso. O uso indevido da conta para disparos não autorizados ou práticas ilegais ensejará o cancelamento imediato da assinatura.
            </p>

            <h4 style={{ color: 'var(--color-text-primary)' }}>3. Disponibilidade e Serviços de Terceiros</h4>
            <p>
              A integração com canais de mensageria (como WhatsApp) depende da disponibilidade de APIs de terceiros. A plataforma emprega filas de mensagens e tolerância a falhas para garantir máxima entrega.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};