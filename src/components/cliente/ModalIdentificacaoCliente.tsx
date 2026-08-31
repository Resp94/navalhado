import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { maskPhone } from '../../lib/whatsapp';
import { TurnstileCaptcha } from '../TurnstileCaptcha';

export interface ModalIdentificacaoClienteProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, phone: string, captchaToken: string | null) => Promise<void>;
  turnstileSiteKey?: string;
  loading?: boolean;
}

export const ModalIdentificacaoCliente: React.FC<ModalIdentificacaoClienteProps> = ({
  isOpen,
  onClose,
  onConfirm,
  turnstileSiteKey,
  loading = false,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.length < 14) return;
    await onConfirm(name, phone, captchaToken);
  };

  return (
    <div className="modal-backdrop-custom">
      <div className="modal-dialog-card">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="modal-btn-close"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        <div style={{ textAlign: 'left', paddingTop: '0.25rem', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#2D231E', margin: 0 }}>
            Gerenciar meus agendamentos
          </h2>
          <p style={{ fontSize: '0.75rem', color: '#70625B', marginTop: '0.25rem', marginBottom: 0, lineHeight: 1.4 }}>
            Informe seus dados para acessar seus agendamentos nesta barbearia.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginTop: '0.5rem' }}>
          <div className="cliente-input-group">
            <label className="cliente-input-label">
              Nome e sobrenome *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Jonathas Lopes"
              disabled={loading}
              className="cliente-input"
            />
          </div>

          <div className="cliente-input-group">
            <label className="cliente-input-label">
              Telefone / WhatsApp com DDD *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(92) 99420-4756"
              disabled={loading}
              className="cliente-input"
              style={{ borderColor: '#D96C00' }}
            />
          </div>

          {turnstileSiteKey && (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '0.25rem 0' }}>
              <TurnstileCaptcha
                siteKey={turnstileSiteKey}
                onTokenChange={(token) => setCaptchaToken(token)}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#FFFFFF', color: '#70625B', border: '1px solid #EADED6', cursor: 'pointer' }}
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || phone.length < 14 || (Boolean(turnstileSiteKey) && !captchaToken)}
              className="btn-cliente-primary"
              style={{ flex: 1 }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 14, height: 14 }} />
                  <span>Acessando...</span>
                </>
              ) : (
                <span>Continuar</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
