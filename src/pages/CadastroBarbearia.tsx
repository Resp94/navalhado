import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { Input } from '../components/Input';
import { LegalModal } from '../components/legal/LegalModal';
import { ArrowRightIcon, SuccessIcon } from '../components/Icons';

interface Plan {
  id: string;
  name: string;
  price: string;
  limit: string;
  description: string;
}

const PLANOS: Plan[] = [
  { id: 'bronze', name: 'Bronze', price: '49,90', limit: 'Até 3 profissionais', description: 'Para quem está começando e quer organizar a agenda.' },
  { id: 'prata', name: 'Prata', price: '89,90', limit: 'Até 8 profissionais', description: 'Para barbearias com equipe e movimento crescentes.' },
  { id: 'ouro', name: 'Ouro', price: '149,90', limit: 'Profissionais ilimitados', description: 'Para redes que precisam de gestão completa e escala.' }
];

const PAGE_CLASS = 'min-h-screen min-h-dvh flex items-center justify-center px-6 py-8 relative overflow-y-auto';

const SHELL_CLASS =
  'w-full max-w-[580px] p-[6px] rounded-[calc(var(--radius-xl)+6px)] bg-[rgba(217,108,0,0.04)] ' +
  'shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] [animation:slideUp_0.45s_cubic-bezier(0.16,1,0.3,1)_both] z-2 ' +
  'max-[540px]:p-1';

const CARD_CLASS =
  'bg-bg-secondary rounded-xl w-full flex flex-col gap-6 relative ' +
  'shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_1px_2px_rgba(45,35,30,0.04),var(--shadow-lg)] ' +
  'pt-10 px-9 pb-8 max-[540px]:pt-8 max-[540px]:px-5 max-[540px]:pb-7';

export const CadastroBarbearia: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [legalModalMode, setLegalModalMode] = useState<'privacy' | 'terms' | null>(null);

  // --- Etapa 1: Dados da Barbearia ---
  const [barbeariaNome, setBarbeariaNome] = useState('');
  const [barbeariaEmail, setBarbeariaEmail] = useState('');
  const [barbeariaPhone, setBarbeariaPhone] = useState('');

  // --- Etapa 2: Dados do Gestor & Plano ---
  const [gestorNome, setGestorNome] = useState('');
  const [gestorEmail, setGestorEmail] = useState('');
  const [gestorSenha, setGestorSenha] = useState('');
  const [planoSelecionado, setPlanoSelecionado] = useState('prata');

  // --- Erros de Validação ---
  const [emailBarbeariaError, setEmailBarbeariaError] = useState('');
  const [phoneBarbeariaError, setPhoneBarbeariaError] = useState('');
  const [emailGestorError, setEmailGestorError] = useState('');
  const [senhaGestorError, setSenhaGestorError] = useState('');

  // --- Máscara e Validação de Telefone ---
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const digits = rawValue.replace(/\D/g, '');

    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 6) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    } else if (digits.length <= 10) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    } else {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    }
    setBarbeariaPhone(formatted);
  };

  // --- Validações em tempo real ---
  useEffect(() => {
    if (!barbeariaEmail) { setEmailBarbeariaError(''); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailBarbeariaError(emailRegex.test(barbeariaEmail) ? '' : 'E-mail comercial inválido.');
  }, [barbeariaEmail]);

  useEffect(() => {
    if (!barbeariaPhone) { setPhoneBarbeariaError(''); return; }
    const digits = barbeariaPhone.replace(/\D/g, '');
    setPhoneBarbeariaError(digits.length >= 10 && digits.length <= 11 ? '' : 'Telefone incompleto.');
  }, [barbeariaPhone]);

  useEffect(() => {
    if (!gestorEmail) { setEmailGestorError(''); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailGestorError(emailRegex.test(gestorEmail) ? '' : 'E-mail de acesso inválido.');
  }, [gestorEmail]);

  useEffect(() => {
    if (!gestorSenha) { setSenhaGestorError(''); return; }
    setSenhaGestorError(gestorSenha.length >= 8 ? '' : 'Mínimo 8 caracteres.');
  }, [gestorSenha]);

  // --- Força da Senha ---
  const getPasswordStrength = () => {
    if (!gestorSenha) return { score: 0, text: '', color: 'transparent' };
    let score = 0;
    if (gestorSenha.length >= 8) score++;
    if (/[A-Z]/.test(gestorSenha)) score++;
    if (/[0-9]/.test(gestorSenha)) score++;
    if (/[^A-Za-z0-9]/.test(gestorSenha)) score++;

    if (score <= 1) return { score, text: 'Fraca', color: 'var(--color-error)' };
    if (score === 2) return { score, text: 'Média', color: 'var(--color-warning)' };
    return { score, text: 'Forte', color: 'var(--color-success)' };
  };

  const pwdStrength = getPasswordStrength();

  // --- Navegação entre etapas ---
  const nextStep = () => {
    if (!barbeariaNome || !barbeariaEmail || !barbeariaPhone) {
      addToast('Preencha todos os dados da barbearia.', 'warning');
      return;
    }
    if (emailBarbeariaError || phoneBarbeariaError) {
      addToast('Corrija os erros antes de continuar.', 'warning');
      return;
    }
    setStep(2);
  };

  const prevStep = () => {
    setStep(1);
  };

  // --- Submissão Final ---
  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gestorNome || !gestorEmail || !gestorSenha) {
      addToast('Preencha todos os dados do gestor.', 'warning');
      return;
    }
    if (emailGestorError || senhaGestorError) {
      addToast('Corrija os campos pendentes antes de enviar.', 'warning');
      return;
    }

    setLoading(true);

    try {
      // O trigger de Auth cria tenant, assinatura e gerente na mesma transação.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: gestorEmail,
        password: gestorSenha,
        options: {
          data: {
            name: gestorNome,
            tenant_signup: {
              name: barbeariaNome,
              email: barbeariaEmail,
              phone: barbeariaPhone.replace(/\D/g, ''),
              plan: planoSelecionado,
            },
          }
        }
      });

      if (authError) {
        throw authError;
      }

      addToast('Cadastro realizado.', 'success');

      // Se já houver sessão ativa, podemos prosseguir diretamente para o Onboarding.
      if (authData.session) {
        setTimeout(() => navigate('/onboarding'), 1500);
      } else {
        // Indica que e-mail de confirmação é exigido
        setSuccess(true);
      }

    } catch (error: any) {
      addToast(error.message || 'Ocorreu um erro ao criar a barbearia.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isStep1Disabled = !barbeariaNome || !barbeariaEmail || !barbeariaPhone || !!emailBarbeariaError || !!phoneBarbeariaError;
  const isSubmitDisabled = loading || !gestorNome || !gestorEmail || !gestorSenha || !!emailGestorError || !!senhaGestorError;

  if (success) {
    return (
      <>
        <div className="noise-overlay" />
        <div className={PAGE_CLASS}>
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_85%_55%_at_50%_15%,rgba(217,108,0,0.08)_0%,transparent_60%),radial-gradient(ellipse_55%_45%_at_85%_85%,rgba(242,178,119,0.06)_0%,transparent_55%)]" />
          <div className={SHELL_CLASS}>
            <div className={`${CARD_CLASS} text-center items-center py-12 px-10`}>
              <div className="bg-success-bg text-success p-5 rounded-full flex items-center justify-center mb-2 shadow-[0_4px_12px_rgba(14,159,110,0.15)]">
                <SuccessIcon size={48} />
              </div>
              <h1 className="text-2xl font-bold text-text-primary tracking-[-0.02em] m-0">Conta criada</h1>
              <p className="text-base leading-[1.6] text-text-secondary m-0">
                A barbearia <strong>{barbeariaNome}</strong> foi cadastrada com sucesso.
              </p>
              <div className="bg-bg-primary border border-dashed border-border rounded-lg p-6 my-4 w-full text-sm text-text-primary leading-[1.5]">
                <p>
                  Enviamos um link de confirmação para o e-mail do gestor: <br />
                  <strong>{gestorEmail}</strong>.
                </p>
                <p className="mt-3 text-xs text-text-secondary">
                  Acesse sua caixa de entrada e clique no link para ativar seu acesso administrativo.
                </p>
              </div>
              <button
                onClick={() => navigate('/')}
                className="btn btn--primary w-full"
              >
                Ir para o login
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="noise-overlay" />
      <div className={PAGE_CLASS}>
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_85%_55%_at_50%_15%,rgba(217,108,0,0.08)_0%,transparent_60%),radial-gradient(ellipse_55%_45%_at_85%_85%,rgba(242,178,119,0.06)_0%,transparent_55%)]" />

        <div className={SHELL_CLASS}>
          <div className={CARD_CLASS}>
            {/* Cabeçalho */}
            <div className="flex flex-col items-center gap-1.5 text-center [animation:slideUp_0.4s_cubic-bezier(0.16,1,0.3,1)_both] [animation-delay:0.05s]">
              <span className="inline-block px-3 py-1 rounded-full bg-brand-lightest text-brand-primary text-[0.625rem] font-semibold uppercase tracking-[0.2em] mb-1">
                cadastro
              </span>
              <div className="bg-brand-lightest p-[0.875rem] rounded-full flex items-center justify-center text-brand-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_4px_14px_rgba(217,108,0,0.12)] mb-1">
                <img src="/simbolo.svg" alt="Navalhado" className="w-[50px] h-[50px] block" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary tracking-[-0.02em] m-0">Criar conta</h1>
              <p className="text-sm text-text-secondary m-0 font-normal">
                Cadastre sua barbearia e comece a gerenciar seus agendamentos em minutos.
              </p>
            </div>

            {/* Indicador de Passos */}
            <div className="flex items-center justify-center gap-3 py-2">
              <div className={`flex items-center gap-2 transition-opacity duration-300 ${step >= 1 ? 'opacity-100' : 'opacity-45'}`}>
                <span
                  className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all duration-300 ${
                    step >= 1 ? 'bg-brand-primary text-white' : 'bg-border text-text-secondary'
                  }`}
                >
                  1
                </span>
                <span className={`text-xs font-semibold ${step >= 1 ? 'text-text-primary font-bold' : 'text-text-primary'}`}>Barbearia</span>
              </div>
              <div className="h-px w-10 bg-border" />
              <div className={`flex items-center gap-2 transition-opacity duration-300 ${step >= 2 ? 'opacity-100' : 'opacity-45'}`}>
                <span
                  className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all duration-300 ${
                    step >= 2 ? 'bg-brand-primary text-white' : 'bg-border text-text-secondary'
                  }`}
                >
                  2
                </span>
                <span className={`text-xs font-semibold ${step >= 2 ? 'text-text-primary font-bold' : 'text-text-primary'}`}>Acesso e Plano</span>
              </div>
            </div>

            {/* Formulário */}
            <form onSubmit={handleCadastro} className="flex flex-col gap-6">
              {step === 1 && (
                <div className="flex flex-col gap-5 [animation:slideUp_0.4s_cubic-bezier(0.32,0.72,0,1)_both]">
                  <Input
                    label="Nome Comercial da Barbearia"
                    placeholder="Ex: Barbearia Estilo"
                    value={barbeariaNome}
                    onChange={(e) => setBarbeariaNome(e.target.value)}
                    disabled={loading}
                    required
                  />

                  <Input
                    label="E-mail Comercial"
                    type="email"
                    icon="email"
                    placeholder="comercial@suabarbearia.com"
                    value={barbeariaEmail}
                    onChange={(e) => setBarbeariaEmail(e.target.value)}
                    error={emailBarbeariaError}
                    disabled={loading}
                    required
                  />

                  <Input
                    label="WhatsApp de Contato"
                    type="tel"
                    placeholder="(99) 99999-9999"
                    value={barbeariaPhone}
                    onChange={handlePhoneChange}
                    error={phoneBarbeariaError}
                    disabled={loading}
                    required
                  />

                  <div className="mt-2">
                    <button
                      type="button"
                      className="btn btn--primary w-full"
                      onClick={nextStep}
                      disabled={isStep1Disabled}
                    >
                      Continuar
                      <span className="btn__icon">
                        <ArrowRightIcon size={16} />
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-5 [animation:slideUp_0.4s_cubic-bezier(0.32,0.72,0,1)_both]">
                  <Input
                    label="Nome Completo do Gestor"
                    placeholder="Seu nome"
                    value={gestorNome}
                    onChange={(e) => setGestorNome(e.target.value)}
                    disabled={loading}
                    required
                  />

                  <Input
                    label="E-mail de Login"
                    type="email"
                    icon="email"
                    placeholder="seu.login@email.com"
                    value={gestorEmail}
                    onChange={(e) => setGestorEmail(e.target.value)}
                    error={emailGestorError}
                    disabled={loading}
                    required
                  />

                  <div className="flex flex-col gap-1">
                    <Input
                      label="Senha de Acesso"
                      type="password"
                      icon="lock"
                      placeholder="Mínimo 8 caracteres"
                      value={gestorSenha}
                      onChange={(e) => setGestorSenha(e.target.value)}
                      error={senhaGestorError}
                      disabled={loading}
                      required
                    />
                    {gestorSenha && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full w-0 rounded-full transition-all duration-300"
                            style={{
                              width: `${(pwdStrength.score / 4) * 100}%`,
                              backgroundColor: pwdStrength.color
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: pwdStrength.color, fontWeight: 500 }}>
                          Força da senha: {pwdStrength.text}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Seleção de Planos */}
                  <div className="flex flex-col gap-2 text-left">
                    <label className="text-sm text-text-primary font-medium">Selecione um plano:</label>
                    <div className="grid grid-cols-3 gap-3 max-[540px]:grid-cols-1 max-[540px]:gap-2">
                      {PLANOS.map((plano) => (
                        <div
                          key={plano.id}
                          className={`border rounded-lg p-4 px-3 cursor-pointer flex flex-col gap-1.5 bg-bg-secondary transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-brand-soft hover:-translate-y-0.5 hover:shadow-sm max-[540px]:flex-row max-[540px]:flex-wrap max-[540px]:items-center max-[540px]:justify-between max-[540px]:p-4 ${
                            planoSelecionado === plano.id
                              ? 'border-brand-primary bg-brand-lightest shadow-[0_0_0_1px_var(--color-brand-primary),var(--shadow-md)]'
                              : 'border-border'
                          }`}
                          onClick={() => setPlanoSelecionado(plano.id)}
                        >
                          <div className="flex flex-col gap-0.5 max-[540px]:flex-row max-[540px]:items-center max-[540px]:gap-2">
                            <span className="text-sm font-bold text-text-primary">{plano.name}</span>
                            <div className="flex items-baseline text-brand-primary">
                              <span className="text-[0.65rem] font-semibold">R$</span>
                              <span className="text-lg font-extrabold tracking-[-0.02em]">{plano.price}</span>
                              <span className="text-[0.65rem] text-text-secondary ml-0.5">/mês</span>
                            </div>
                          </div>
                          <span className="text-[0.65rem] font-semibold text-success bg-success-bg px-1.5 py-0.5 rounded-full inline-block self-start max-[540px]:self-center">
                            {plano.limit}
                          </span>
                          <p className="text-[0.65rem] text-text-secondary leading-[1.4] m-0 max-[540px]:w-full max-[540px]:mt-1">
                            {plano.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2 flex gap-4">
                    <button
                      type="button"
                      className="btn btn--secondary flex-1"
                      onClick={prevStep}
                      disabled={loading}
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      className="btn btn--primary flex-[2]"
                      disabled={isSubmitDisabled}
                    >
                      {loading ? (
                        <>
                          <div className="spinner" />
                          Criando…
                        </>
                      ) : (
                        'Criar conta'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Botão de voltar geral */}
              <div className="flex items-center justify-center gap-1 pt-4 border-t border-border mt-2">
                <span className="text-xs text-text-secondary">
                  Já tem uma conta?{' '}
                </span>
                <button
                  type="button"
                  className="btn btn--link !text-xs"
                  onClick={() => navigate('/')}
                  disabled={loading}
                >
                  Fazer Login
                </button>
              </div>

              {/* Rodapé Legal / LGPD */}
              <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle,rgba(255,255,255,0.08))] flex justify-center gap-3 text-xs text-[var(--color-text-tertiary,#999)]">
                <button
                  type="button"
                  className="bg-none border-none p-0 text-inherit underline cursor-pointer"
                  onClick={() => setLegalModalMode('terms')}
                >
                  Termos de uso
                </button>
                <span>•</span>
                <button
                  type="button"
                  className="bg-none border-none p-0 text-inherit underline cursor-pointer"
                  onClick={() => setLegalModalMode('privacy')}
                >
                  Privacidade (LGPD)
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ─── MODAL LGPD / TERMOS ─── */}
      {legalModalMode && (
        <LegalModal
          isOpen={!!legalModalMode}
          onClose={() => setLegalModalMode(null)}
          mode={legalModalMode}
        />
      )}
    </>
  );
};
