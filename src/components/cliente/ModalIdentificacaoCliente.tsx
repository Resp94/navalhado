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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(20,17,15,0.6)] backdrop-blur-[4px] box-border">
      <div className="w-full max-w-[390px] max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-border p-6 shadow-[0_16px_48px_rgba(45,35,30,0.2)] relative box-border">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-brand-lightest border border-border text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-brand-soft hover:text-text-primary"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        <div className="text-left pt-1 pb-3">
          <h2 className="text-base font-extrabold text-text-primary m-0">
            Gerenciar meus agendamentos
          </h2>
          <p className="text-xs text-text-secondary mt-1 mb-0 leading-[1.4]">
            Informe seus dados para acessar seus agendamentos nesta barbearia.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 mt-2">
          <div className="flex flex-col gap-1">
            <label className="text-[0.6875rem] font-bold text-text-primary uppercase tracking-[0.05em]">
              Nome e sobrenome *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Jonathas Lopes"
              disabled={loading}
              className="w-full py-[0.625rem] px-[0.875rem] rounded-xl border border-border text-xs font-semibold text-text-primary bg-white transition-colors duration-200 box-border focus:border-brand-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[0.6875rem] font-bold text-text-primary uppercase tracking-[0.05em]">
              Telefone / WhatsApp com DDD *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(92) 99420-4756"
              disabled={loading}
              className="w-full py-[0.625rem] px-[0.875rem] rounded-xl border border-brand-primary text-xs font-semibold text-text-primary bg-white transition-colors duration-200 box-border focus:border-brand-primary focus:outline-none"
            />
          </div>

          {turnstileSiteKey && (
            <div className="flex justify-center my-1">
              <TurnstileCaptcha
                siteKey={turnstileSiteKey}
                onTokenChange={(token) => setCaptchaToken(token)}
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-full text-xs font-bold bg-white text-text-secondary border border-border cursor-pointer"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || phone.length < 14 || (Boolean(turnstileSiteKey) && !captchaToken)}
              className="flex-1 py-3 px-4 rounded-full text-xs font-extrabold bg-brand-primary text-brand-lightest border-none cursor-pointer shadow-[0_4px_12px_rgba(217,108,0,0.2)] transition-all duration-200 flex items-center justify-center gap-2 hover:not-disabled:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
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
