import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { ArrowRightIcon, LockIcon } from '../components/Icons';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetEmailError, setResetEmailError] = useState('');

  // --- Validação inline em tempo real ---
  useEffect(() => {
    if (!email) { setEmailError(''); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailError(emailRegex.test(email) ? '' : 'E-mail inválido.');
  }, [email]);

  useEffect(() => {
    if (!password) { setPasswordError(''); return; }
    setPasswordError(password.length >= 6 ? '' : 'Mínimo 6 caracteres.');
  }, [password]);

  useEffect(() => {
    if (!resetEmail) { setResetEmailError(''); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setResetEmailError(emailRegex.test(resetEmail) ? '' : 'E-mail inválido.');
  }, [resetEmail]);

  // --- Helpers ---
  const translateAuthError = (message: string) => {
    const msg = message.toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
      return 'E-mail ou senha incorretos. Tente novamente.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Confirme seu e-mail antes de fazer login.';
    }
    if (msg.includes('user not found')) {
      return 'Nenhuma conta encontrada com este e-mail.';
    }
    return `Não foi possível entrar: ${message}`;
  };

  const resolveRole = async (userId: string): Promise<string> => {
    const { data: profile, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    const allowedRoles = ['proprietario', 'gerente', 'barbeiro'];
    if (error || !profile?.role || !allowedRoles.includes(profile.role)) {
      throw new Error('Perfil de acesso não encontrado.');
    }
    return profile.role;
  };

  const navigateByRole = (role: string) => {
    const routes: Record<string, string> = {
      proprietario: '/admin/dashboard',
      gerente: '/dashboard',
      barbeiro: '/minha-agenda',
    };
    const route = routes[role];
    setTimeout(() => navigate(route || '/'), 600);
    if (!route) addToast('Perfil sem rota atribuída.', 'warning');
  };

  // --- Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setEmailError('Digite seu e-mail.');
      addToast('Digite seu e-mail para entrar.', 'error');
      return;
    }
    if (!password || password.length < 6) {
      setPasswordError('A senha deve ter no mínimo 6 caracteres.');
      addToast('A senha precisa ter pelo menos 6 caracteres.', 'error');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user) {
        addToast('Login realizado. Carregando perfil…', 'success');
        try {
          const role = await resolveRole(data.user.id);
          navigateByRole(role);
        } catch (profileError) {
          await supabase.auth.signOut();
          throw profileError;
        }
      }
    } catch (error: any) {
      addToast(translateAuthError(error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetEmail) {
      setResetEmailError('Digite seu e-mail.');
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;

      addToast('Link de recuperação enviado para seu e-mail.', 'success');
      setIsResetOpen(false);
      setResetEmail('');
    } catch (error: any) {
      addToast(`Erro ao enviar recuperação: ${error.message}`, 'error');
    } finally {
      setResetLoading(false);
    }
  };

  const isSubmitDisabled = loading || !!emailError || !!passwordError;
  const isResetSubmitDisabled = resetLoading || !resetEmail || !!resetEmailError;

  return (
    <>
      {/* Noise/grain overlay — textura premium fixa */}
      <div className="noise-overlay" />

      <div className="login-page">
        {/* Background gradient orbes */}
        <div className="login-page__bg" />

        {/* ─── DOUBLE-BEZEL CARD ─── */}
        {/* Outer shell: moldura sutil aquecida */}
        <div className="login-card__shell">
          {/* Inner core: card propriamente dito */}
          <div className="login-card">
            {/* HEADER */}
            <div className="login-card__header">
              <span className="login-card__eyebrow">plataforma</span>

              <div className="login-card__icon">
                <img src="/simbolo.svg" alt="Navalhado" style={{ width: '50px', height: '50px', display: 'block' }} />
              </div>

              <h1 className="login-card__title">Navalhado</h1>
              <p className="login-card__subtitle">
                Gerencie sua barbearia com confiança
              </p>
            </div>

            {/* FORM */}
            <form onSubmit={handleLogin} className="login-card__form">
              <Input
                label="E-mail"
                type="email"
                icon="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={emailError}
                disabled={loading}
                required
              />

              <Input
                label="Senha"
                type="password"
                icon="lock"
                placeholder="mín. 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={passwordError}
                disabled={loading}
                required
              />

              {/* Esqueci a senha — logo abaixo do campo de senha */}
              <div className="login-card__forgot">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setIsResetOpen(true)}
                >
                  Esqueci a senha
                </button>
              </div>

              {/* CTA — Button-in-Button pattern */}
              <button
                type="submit"
                className="btn btn--primary login-card__cta"
                disabled={isSubmitDisabled}
              >
                {loading ? (
                  <>
                    <div className="spinner" />
                    Entrando…
                  </>
                ) : (
                  <>
                    Acessar plataforma
                    <span className="btn__icon">
                      <ArrowRightIcon size={16} />
                    </span>
                  </>
                )}
              </button>

              {/* Criar conta — abaixo do CTA, separado visualmente */}
              <div className="login-card__signup">
                <span className="login-card__signup-text">
                  Não tem conta?{' '}
                </span>
                <button
                  type="button"
                  className="btn btn--link login-card__signup-btn"
                  onClick={() => navigate('/signup')}
                >
                  Criar conta
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ─── MODAL DE RECUPERAÇÃO ─── */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => {
          setIsResetOpen(false);
          setResetEmail('');
          setResetEmailError('');
        }}
        title="Redefinir senha"
      >
        <div className="modal-reset">
          {/* Ícone decorativo */}
          <div className="modal-reset__icon">
            <LockIcon size={22} />
          </div>

          <p className="modal-reset__description">
            Digite seu e-mail e enviaremos um link seguro para criar uma nova senha.
          </p>

          <form onSubmit={handleResetPassword} className="modal-reset__form">
            <Input
              label="E-mail"
              type="email"
              icon="email"
              placeholder="seu@email.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              error={resetEmailError}
              disabled={resetLoading}
              required
            />

            <button
              type="submit"
              className="btn btn--primary modal-reset__btn"
              disabled={isResetSubmitDisabled}
            >
              {resetLoading ? (
                <>
                  <div className="spinner spinner--sm" />
                  Enviando…
                </>
              ) : (
                'Enviar link'
              )}
            </button>
          </form>
        </div>
      </Modal>

      {/* ─── PAGE-SPECIFIC STYLES ─── */}
      <style>{`
        .login-page {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
        }

        .login-page__bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 85% 55% at 45% 35%, rgba(217, 108, 0, 0.07) 0%, transparent 65%),
            radial-gradient(ellipse 55% 45% at 80% 80%, rgba(242, 178, 119, 0.08) 0%, transparent 55%);
          pointer-events: none;
        }

        /* ── Double-Bezel (Doppelrand) ── */
        .login-card__shell {
          width: 100%;
          max-width: 420px;
          padding: 6px;
          border-radius: calc(var(--radius-xl) + 6px);
          background: rgba(217, 108, 0, 0.04);
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4);
          animation: springUp 0.6s cubic-bezier(0.32, 0.72, 0, 1) both;
        }

        .login-card {
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-xl);
          padding: 2.5rem 2rem 2rem;
          width: 100%;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
          position: relative;
          box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.6),
            0 1px 2px rgba(45, 35, 30, 0.04),
            var(--shadow-lg);
        }

        /* Staggered entry for card children */
        .login-card__header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.375rem;
          animation: springUp 0.5s cubic-bezier(0.32, 0.72, 0, 1) both;
          animation-delay: 0.08s;
        }

        .login-card__eyebrow {
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

        .login-card__icon {
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
          transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1),
                      box-shadow 0.4s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .login-card__icon img {
          transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .login-card:hover .login-card__icon {
          box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.5),
            0 6px 20px rgba(217, 108, 0, 0.18);
        }

        .login-card:hover .login-card__icon img {
          transform: scale(1.1);
        }

        .login-card__title {
          font-size: var(--font-size-3xl);
          font-weight: 700;
          color: var(--color-text-primary);
          letter-spacing: -0.03em;
          margin: 0;
          text-wrap: balance;
        }

        .login-card__subtitle {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          margin: 0;
          font-weight: 400;
          letter-spacing: 0.01em;
        }

        .login-card__form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          animation: springUp 0.5s cubic-bezier(0.32, 0.72, 0, 1) both;
          animation-delay: 0.16s;
        }

        .login-card__forgot {
          display: flex;
          justify-content: flex-end;
          margin-top: -0.5rem;
        }

        .login-card__cta {
          width: 100%;
          padding: 0.85rem 1.5rem;
          font-size: var(--font-size-base);
        }

        .login-card__signup {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--color-border);
          margin-top: 0.5rem;
        }

        .login-card__signup-text {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .login-card__signup-btn {
          font-size: var(--font-size-xs) !important;
        }

        .modal-reset {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          animation: springUp 0.5s cubic-bezier(0.32, 0.72, 0, 1) both;
          animation-delay: 0.1s;
        }

        .modal-reset__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 3rem;
          border-radius: var(--radius-full);
          background: linear-gradient(135deg, var(--color-brand-lightest) 0%, #FFE4D6 100%);
          color: var(--color-brand-primary);
          box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.5),
            0 4px 12px rgba(217, 108, 0, 0.1);
          margin-bottom: 0.25rem;
        }

        .modal-reset__description {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          line-height: 1.6;
          margin: 0;
          text-align: center;
          max-width: 32ch;
        }

        .modal-reset__form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          width: 100%;
          margin-top: 0.5rem;
        }

        .modal-reset__btn {
          width: 100%;
        }

        /* Mobile refinements */
        @media (max-width: 480px) {
          .login-card__shell {
            padding: 4px;
            border-radius: var(--radius-xl);
          }
          .login-card {
            padding: 2rem 1.25rem 1.75rem;
            border-radius: calc(var(--radius-xl) - 2px);
          }
          .login-card__title {
            font-size: var(--font-size-2xl);
          }
        }
      `}</style>
    </>
  );
};
