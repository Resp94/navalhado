import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { Input } from '../components/Input';
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

export const CadastroBarbearia: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
    setSenhaGestorError(gestorSenha.length >= 6 ? '' : 'Mínimo 6 caracteres.');
  }, [gestorSenha]);

  // --- Força da Senha ---
  const getPasswordStrength = () => {
    if (!gestorSenha) return { score: 0, text: '', color: 'transparent' };
    let score = 0;
    if (gestorSenha.length >= 6) score++;
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
      
      // Se já houver sessão ativa, podemos prosseguir diretamente.
      if (authData.session) {
        setTimeout(() => navigate('/dashboard'), 1500);
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
        <div className="signup-page">
          <div className="signup-page__bg" />
          <div className="signup-card__shell">
            <div className="signup-card signup-card--success">
              <div className="signup-card__success-icon">
                <SuccessIcon size={48} />
              </div>
              <h1 className="signup-card__title">Conta criada</h1>
              <p className="signup-card__subtitle" style={{ fontSize: 'var(--font-size-base)', lineHeight: '1.6' }}>
                A barbearia <strong>{barbeariaNome}</strong> foi cadastrada com sucesso.
              </p>
              <div className="success-box">
                <p>
                  Enviamos um link de confirmação para o e-mail do gestor: <br />
                  <strong>{gestorEmail}</strong>.
                </p>
                <p style={{ marginTop: '0.75rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Acesse sua caixa de entrada e clique no link para ativar seu acesso administrativo.
                </p>
              </div>
              <button
                onClick={() => navigate('/')}
                className="btn btn--primary"
                style={{ width: '100%' }}
              >
                Ir para o login
              </button>
            </div>
          </div>
        </div>
        <style>{styles}</style>
      </>
    );
  }

  return (
    <>
      <div className="noise-overlay" />
      <div className="signup-page">
        <div className="signup-page__bg" />

        <div className="signup-card__shell">
          <div className="signup-card">
            {/* Cabeçalho */}
            <div className="signup-card__header">
              <span className="signup-card__eyebrow">cadastro</span>
              <div className="signup-card__icon">
                <img src="/simbolo.svg" alt="Navalhado" style={{ width: '50px', height: '50px', display: 'block' }} />
              </div>
              <h1 className="signup-card__title">Criar conta</h1>
              <p className="signup-card__subtitle">
                Cadastre sua barbearia e comece a gerenciar seus agendamentos em minutos.
              </p>
            </div>

            {/* Indicador de Passos */}
            <div className="step-indicator">
              <div className={`step-indicator__item ${step >= 1 ? 'step-indicator__item--active' : ''}`}>
                <span className="step-indicator__number">1</span>
                <span className="step-indicator__text">Barbearia</span>
              </div>
              <div className="step-indicator__line" />
              <div className={`step-indicator__item ${step >= 2 ? 'step-indicator__item--active' : ''}`}>
                <span className="step-indicator__number">2</span>
                <span className="step-indicator__text">Acesso e Plano</span>
              </div>
            </div>

            {/* Formulário */}
            <form onSubmit={handleCadastro} className="signup-card__form">
              {step === 1 && (
                <div className="form-step-container">
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

                  <div className="signup-card__actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={nextStep}
                      disabled={isStep1Disabled}
                      style={{ width: '100%' }}
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
                <div className="form-step-container">
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <Input
                      label="Senha de Acesso"
                      type="password"
                      icon="lock"
                      placeholder="Mínimo 6 caracteres"
                      value={gestorSenha}
                      onChange={(e) => setGestorSenha(e.target.value)}
                      error={senhaGestorError}
                      disabled={loading}
                      required
                    />
                    {gestorSenha && (
                      <div className="pwd-strength-indicator">
                        <div className="pwd-strength-bar">
                          <div
                            className="pwd-strength-fill"
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
                  <div className="plans-selection">
                    <label className="plans-selection__label">Selecione um plano:</label>
                    <div className="plans-grid">
                      {PLANOS.map((plano) => (
                        <div
                          key={plano.id}
                          className={`plan-card ${planoSelecionado === plano.id ? 'plan-card--selected' : ''}`}
                          onClick={() => setPlanoSelecionado(plano.id)}
                        >
                          <div className="plan-card__header">
                            <span className="plan-card__name">{plano.name}</span>
                            <div className="plan-card__price">
                              <span className="plan-card__symbol">R$</span>
                              <span className="plan-card__val">{plano.price}</span>
                              <span className="plan-card__cycle">/mês</span>
                            </div>
                          </div>
                          <span className="plan-card__limit">{plano.limit}</span>
                          <p className="plan-card__desc">{plano.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="signup-card__actions" style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={prevStep}
                      disabled={loading}
                      style={{ flex: 1 }}
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={isSubmitDisabled}
                      style={{ flex: 2 }}
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
              <div className="signup-card__signup">
                <span className="signup-card__signup-text">
                  Já tem uma conta?{' '}
                </span>
                <button
                  type="button"
                  className="btn btn--link signup-card__signup-btn"
                  onClick={() => navigate('/')}
                  disabled={loading}
                >
                  Fazer Login
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <style>{styles}</style>
    </>
  );
};

const styles = `
.signup-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  position: relative;
  overflow-y: auto;
}

.signup-page__bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 85% 55% at 50% 15%, rgba(217, 108, 0, 0.08) 0%, transparent 60%),
    radial-gradient(ellipse 55% 45% at 85% 85%, rgba(242, 178, 119, 0.06) 0%, transparent 55%);
  pointer-events: none;
}

.signup-card__shell {
  width: 100%;
  max-width: 580px;
  padding: 6px;
  border-radius: calc(var(--radius-xl) + 6px);
  background: rgba(217, 108, 0, 0.04);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4);
  animation: springUp 0.6s cubic-bezier(0.32, 0.72, 0, 1) both;
  z-index: 2;
}

.signup-card {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-xl);
  padding: 2.5rem 2.25rem 2rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: relative;
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.6),
    0 1px 2px rgba(45, 35, 30, 0.04),
    var(--shadow-lg);
}

.signup-card--success {
  text-align: center;
  align-items: center;
  padding: 3rem 2.5rem;
}

.signup-card__success-icon {
  background: var(--color-success-bg);
  color: var(--color-success);
  padding: 1.25rem;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
  box-shadow: 0 4px 12px rgba(14, 159, 110, 0.15);
}

.success-box {
  background-color: var(--color-bg-primary);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  margin: 1rem 0 1.5rem;
  width: 100%;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  line-height: 1.5;
}

.signup-card__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  text-align: center;
  animation: springUp 0.5s cubic-bezier(0.32, 0.72, 0, 1) both;
  animation-delay: 0.08s;
}

.signup-card__eyebrow {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  background: var(--color-brand-lightest);
  color: var(--color-brand-primary);
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  margin-bottom: 0.25rem;
}

.signup-card__icon {
  background: linear-gradient(135deg, var(--color-brand-lightest) 0%, #FFE4D6 100%);
  padding: 0.875rem;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-brand-primary);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.5),
    0 4px 14px rgba(217, 108, 0, 0.12);
  margin-bottom: 0.25rem;
}

.signup-card__icon img {
  /* Sem rotação */
}

.signup-card__title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  margin: 0;
}

.signup-card__subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  font-weight: 400;
}

/* Indicador de Passos */
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.step-indicator__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.45;
  transition: opacity 0.3s ease;
}

.step-indicator__item--active {
  opacity: 1;
}

.step-indicator__number {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.step-indicator__item--active .step-indicator__number {
  background-color: var(--color-brand-primary);
  color: #FFFFFF;
}

.step-indicator__text {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-primary);
}

.step-indicator__line {
  height: 1px;
  width: 40px;
  background-color: var(--color-border);
}

.signup-card__form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-step-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  animation: slideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1) both;
}

.pwd-strength-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.125rem;
}

.pwd-strength-bar {
  flex: 1;
  height: 4px;
  background-color: var(--color-border);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.pwd-strength-fill {
  height: 100%;
  width: 0;
  border-radius: var(--radius-full);
  transition: all 0.3s ease;
}

/* Plan Selection */
.plans-selection {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: left;
}

.plans-selection__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-weight: 500;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.plan-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1rem 0.75rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  background-color: var(--color-bg-secondary);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.plan-card:hover {
  border-color: var(--color-brand-soft);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.plan-card--selected {
  border-color: var(--color-brand-primary);
  background-color: var(--color-brand-lightest);
  box-shadow: 0 0 0 1px var(--color-brand-primary), var(--shadow-md);
}

.plan-card__header {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.plan-card__name {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text-primary);
}

.plan-card__price {
  display: flex;
  align-items: baseline;
  color: var(--color-brand-primary);
}

.plan-card__symbol {
  font-size: 0.65rem;
  font-weight: 600;
}

.plan-card__val {
  font-size: var(--font-size-lg);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.plan-card__cycle {
  font-size: 0.65rem;
  color: var(--color-text-secondary);
  margin-left: 0.125rem;
}

.plan-card__limit {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-success);
  background-color: var(--color-success-bg);
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-full);
  display: inline-block;
  align-self: flex-start;
}

.plan-card__desc {
  font-size: 0.65rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
  margin: 0;
}

.signup-card__actions {
  margin-top: 0.5rem;
}

.signup-card__signup {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
  margin-top: 0.5rem;
}

.signup-card__signup-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.signup-card__signup-btn {
  font-size: var(--font-size-xs) !important;
}

/* Responsividade */
@media (max-width: 540px) {
  .signup-card__shell {
    padding: 4px;
  }
  .signup-card {
    padding: 2rem 1.25rem 1.75rem;
  }
  .plans-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  .plan-card {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
  }
  .plan-card__header {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }
  .plan-card__limit {
    align-self: center;
  }
  .plan-card__desc {
    width: 100%;
    margin-top: 0.25rem;
  }
}
`;
