import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { EyeIcon, EyeOffIcon, LockIcon } from '../../components/Icons';
import { Select } from '../../components/ui';
import { isValidEmailFormat } from '../../lib/email';
import { useValidacaoEmail } from '../../lib/useValidacaoEmail';
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
  const {
    sugestao: emailSugestao,
    validarAoSair: validarEmailAoSair,
    validarParaSalvar: validarEmailParaSalvar,
    aplicarSugestao: aplicarSugestaoEmail,
  } = useValidacaoEmail();

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
    if (!email.trim() || !isValidEmailFormat(email.trim())) {
      addToast('Informe um e-mail válido.', 'warning');
      return;
    }
    const erroDominioEmail = await validarEmailParaSalvar(email.trim());
    if (erroDominioEmail) {
      addToast(erroDominioEmail, 'warning');
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

      addToast(
        `Acesso criado para ${selectedProf?.name}. O barbeiro precisa confirmar o e-mail antes do primeiro login.`,
        'success'
      );

      // Redireciona de volta para a lista de equipe
      navigate('/profissionais');

    } catch (error: any) {
      console.error('Error creating barber access:', error);
      let mensagem = error.message || 'Não foi possível configurar as credenciais.';
      if (error instanceof FunctionsHttpError) {
        try {
          const corpo = await error.context.json();
          if (corpo?.error) {
            mensagem = corpo.error;
          }
        } catch {
          // corpo da resposta não é JSON válido; mantém mensagem genérica
        }
      }
      addToast(mensagem, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[600px] mx-auto w-full flex flex-col gap-4 animate-[slideUp_0.4s_cubic-bezier(0.16,1,0.3,1)]">
      <header className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => navigate('/profissionais')}
          className="bg-transparent border-none text-text-primary text-sm font-bold cursor-pointer py-1 px-0 min-h-9 inline-flex items-center gap-[0.4rem] mb-1 transition-[transform,opacity] duration-200 ease-in-out outline-none hover:opacity-80 hover:-translate-x-[3px] focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus-visible:rounded-sm"
          aria-label="Voltar para a página de equipe"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} aria-hidden="true" />
          <span>Voltar para equipe</span>
        </button>
        <h2 className="text-[clamp(1.25rem,3.5vw,var(--font-size-2xl))] font-extrabold text-text-primary tracking-[-0.02em] m-0 leading-[1.25]">Configurar credenciais de acesso</h2>
        <p className="text-sm text-text-secondary leading-[1.4] m-0">
          Crie o login e senha para que o barbeiro consiga acessar sua própria agenda e comissões no sistema.
        </p>
      </header>

      <div className="bg-bg-secondary border border-border rounded-lg px-6 py-5 shadow-sm">
        {loading ? (
          <div className="py-12 px-6 text-center flex flex-col items-center justify-center gap-2 text-text-secondary">
            <div
              className="spinner"
              style={{ borderColor: 'var(--color-brand-primary)', borderTopColor: 'transparent' }}
            />
            <p>Carregando profissionais disponíveis...</p>
          </div>
        ) : professionals.length === 0 ? (
          <div className="py-12 px-6 text-center flex flex-col items-center justify-center gap-2 text-text-secondary">
            <h4 className="text-lg font-extrabold text-text-primary m-0">Toda a equipe já possui login configurado</h4>
            <p className="text-sm text-text-secondary max-w-[38ch] leading-[1.4] m-0">Se precisar alterar as credenciais de alguém, edite diretamente o cadastro do profissional na página de equipe.</p>
            <button
              type="button"
              onClick={() => navigate('/profissionais')}
              className="bg-brand-primary text-white border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md py-[0.65rem] px-5 font-bold min-h-10 inline-flex items-center justify-center cursor-pointer transition-[background-color,transform] duration-200 ease-in-out hover:not-disabled:bg-brand-hover hover:not-disabled:-translate-y-px disabled:opacity-55 disabled:cursor-not-allowed mt-4"
            >
              Voltar para equipe
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-[0.85rem]">
            <Select
              label="Selecione o barbeiro"
              id="select-prof"
              value={selectedProfId}
              onChange={(e) => setSelectedProfId(e.target.value)}
              required
            >
              <option value="">Selecione o profissional...</option>
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id}>{prof.name} ({prof.phone})</option>
              ))}
            </Select>

            <div className="flex flex-col gap-1">
              <label htmlFor="input-email" className="text-xs font-extrabold text-text-primary uppercase tracking-[0.04em]">E-mail de login</label>
              <input
                id="input-email"
                type="email"
                placeholder="Ex: joao@barbearianavalhado.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={(e) => validarEmailAoSair(e.target.value)}
                aria-describedby="email-helper"
                required
                className="py-[0.65rem] px-[0.85rem] min-h-10 border-0 rounded-md bg-bg-secondary bg-none text-text-primary text-base sm:text-sm shadow-[0_0_0_0.3px_var(--color-text-primary)] outline-none transition-[box-shadow,background-color] duration-200 ease-in-out w-full box-border focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] focus:bg-bg-secondary"
              />
              {emailSugestao && (
                <p className="m-0 text-xs text-text-secondary">
                  Você quis dizer{' '}
                  <button
                    type="button"
                    className="bg-none border-none p-0 text-brand-primary underline cursor-pointer font-semibold"
                    onClick={() => setEmail(aplicarSugestaoEmail())}
                  >
                    {emailSugestao}
                  </button>
                  ?
                </p>
              )}
              <span id="email-helper" className="text-[0.7rem] text-text-secondary mt-[0.1rem] leading-[1.35]">
                Este e-mail será utilizado pelo barbeiro para fazer login na área do colaborador
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="input-password" className="text-xs font-extrabold text-text-primary uppercase tracking-[0.04em]">Senha de acesso</label>
              <div className="relative flex items-center">
                <input
                  id="input-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo de 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-[0.85rem] pr-[3.25rem] py-[0.65rem] min-h-10 border-0 rounded-md bg-bg-secondary bg-none text-text-primary text-base sm:text-sm shadow-[0_0_0_0.3px_var(--color-text-primary)] outline-none transition-[box-shadow,background-color] duration-200 ease-in-out w-full box-border focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)] focus:bg-bg-secondary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 min-w-9 min-h-9 bg-bg-secondary bg-none border-none text-text-primary cursor-pointer inline-flex items-center justify-center rounded-md transition-colors duration-200 ease-in-out outline-none hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-[-2px]"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  aria-controls="input-password"
                >
                  {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
                </button>
              </div>
            </div>

            <div className="bg-brand-lightest shadow-[0_0_0_0.3px_var(--color-text-primary)] border-0 rounded-md py-[0.7rem] px-[0.85rem] text-xs text-text-primary leading-[1.4] flex items-start gap-[0.65rem]" role="note">
              <div className="shrink-0 mt-[0.1rem] text-text-primary flex items-center justify-center">
                <LockIcon size={18} aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-[0.1rem]">
                <strong className="text-text-primary font-bold">Acesso seguro e restrito:</strong>
                <span className="text-text-primary">O profissional terá acesso apenas à visualização da sua própria agenda e relatório de comissões, sem permissão para visualizar dados financeiros gerais ou alterar configurações da barbearia.</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-[0.85rem] mt-1 flex-wrap max-[480px]:flex-col-reverse max-[480px]:flex-nowrap">
              <button
                type="button"
                onClick={() => navigate('/profissionais')}
                className="bg-bg-secondary border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] text-text-primary rounded-md py-[0.65rem] px-5 font-bold min-h-10 inline-flex items-center justify-center cursor-pointer transition-colors duration-200 ease-in-out hover:not-disabled:bg-black/[0.03] disabled:opacity-55 disabled:cursor-not-allowed max-[480px]:w-full"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button type="submit" className="bg-brand-primary text-white border-0 shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-md py-[0.65rem] px-5 font-bold min-h-10 inline-flex items-center justify-center cursor-pointer transition-[background-color,transform] duration-200 ease-in-out hover:not-disabled:bg-brand-hover hover:not-disabled:-translate-y-px disabled:opacity-55 disabled:cursor-not-allowed max-[480px]:w-full" disabled={submitting}>
                {submitting ? <div className="spinner spinner--sm" /> : 'Confirmar e criar acesso'}
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  );
};
