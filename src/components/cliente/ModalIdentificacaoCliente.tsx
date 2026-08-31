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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#14110F]/60 backdrop-blur-xs">
      <div className="w-full max-w-[420px] bg-white rounded-t-3xl sm:rounded-3xl border border-[#EADED6] p-6 shadow-2xl relative">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FFF1E6] hover:bg-[#F2B277]/40 flex items-center justify-center text-[#70625B] transition-colors border border-[#EADED6] cursor-pointer disabled:opacity-50"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        <div className="text-left pt-1 pb-3">
          <h2 className="text-base font-extrabold text-[#2D231E] m-0 tracking-tight">
            Gerenciar meus agendamentos
          </h2>
          <p className="text-xs text-[#70625B] mt-1 mb-0 leading-relaxed">
            Informe seus dados para acessar seus agendamentos nesta barbearia.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 mt-2">
          <div>
            <label className="block text-[11px] font-bold text-[#70625B] uppercase tracking-wider mb-1">
              Nome e sobrenome *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Jonathas Lopes"
              disabled={loading}
              className="w-full py-2.5 px-3.5 rounded-xl border border-[#EADED6] focus:border-[#D96C00] focus:outline-hidden text-xs font-semibold text-[#2D231E] bg-white transition-colors disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#70625B] uppercase tracking-wider mb-1">
              Telefone / WhatsApp com DDD *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(92) 99420-4756"
              disabled={loading}
              className="w-full py-2.5 px-3.5 rounded-xl border border-[#D96C00] focus:border-[#D96C00] focus:outline-hidden text-xs font-semibold text-[#2D231E] bg-white transition-colors disabled:bg-gray-100"
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
              className="flex-1 py-3 px-4 rounded-full text-xs font-bold bg-white hover:bg-[#FFF1E6] text-[#70625B] border border-[#EADED6] transition-colors cursor-pointer disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || phone.length < 14 || (Boolean(turnstileSiteKey) && !captchaToken)}
              className="flex-1 py-3 px-4 rounded-full text-xs font-extrabold bg-[#D96C00] hover:bg-[#9C3F00] text-[#FFF1E6] shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
