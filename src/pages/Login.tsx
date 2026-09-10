import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { LegalModal } from '../components/legal/LegalModal';
import { ArrowRightIcon, LockIcon } from '../components/Icons';

/* ─── Ondas SVG Orgânicas em Camadas ─── */
const VerticalCloudWave: React.FC = () => (
  <svg
    className="login-wave-desktop"
    viewBox="0 0 100 1000"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    {/* Camada 1: Brilho sutil âmbar/dourado */}
    <path
      d="M 100,0 L 45,0
         C 15,35 15,95 42,130
         C 10,175 10,235 40,270
         C 12,320 12,380 44,415
         C 8,465 8,525 40,560
         C 15,610 15,670 42,705
         C 10,755 10,815 40,850
         C 15,900 18,960 45,1000
         L 100,1000 Z"
      fill="rgba(217, 108, 0, 0.22)"
    />
    {/* Camada 2: Névoa translúcida suave */}
    <path
      d="M 100,0 L 60,0
         C 30,40 30,95 55,130
         C 25,180 25,235 52,270
         C 28,325 28,380 56,415
         C 22,470 22,525 52,560
         C 30,615 30,670 55,705
         C 25,760 25,815 52,850
         C 30,905 32,960 58,1000
         L 100,1000 Z"
      fill="rgba(255, 241, 230, 0.55)"
    />
    {/* Camada 3: Nuvem branca frontal recortada */}
    <path
      d="M 100,0 L 75,0
         C 45,45 45,95 70,130
         C 40,185 40,235 68,270
         C 42,330 42,380 72,415
         C 38,475 38,525 68,560
         C 45,620 45,670 70,705
         C 40,765 40,815 68,850
         C 45,910 48,960 74,1000
         L 100,1000 Z"
      fill="#ffffff"
    />
  </svg>
);

const HorizontalCloudWave: React.FC = () => (
  <svg
    className="login-wave-mobile"
    viewBox="0 0 1000 100"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    {/* Camada 1: Âmbar sutil */}
    <path
      d="M 0,100 L 0,45
         C 35,15 95,15 130,42
         C 175,10 235,10 270,40
         C 320,12 380,12 415,44
         C 465,8 525,8 560,40
         C 610,15 670,15 705,42
         C 755,10 815,10 850,40
         C 900,15 960,18 1000,45
         L 1000,100 Z"
      fill="rgba(217, 108, 0, 0.22)"
    />
    {/* Camada 2: Névoa suave */}
    <path
      d="M 0,100 L 0,60
         C 40,30 95,30 130,55
         C 180,25 235,25 270,52
         C 325,28 380,28 415,56
         C 470,22 525,22 560,52
         C 615,30 670,30 705,55
         C 760,25 815,25 850,52
         C 905,30 960,32 1000,58
         L 1000,100 Z"
      fill="rgba(255, 241, 230, 0.55)"
    />
    {/* Camada 3: Branco frontal */}
    <path
      d="M 0,100 L 0,75
         C 45,45 95,45 130,70
         C 185,40 235,40 270,68
         C 330,42 380,42 415,72
         C 475,38 525,38 560,68
         C 620,45 670,45 705,70
         C 765,40 815,40 850,68
         C 910,45 960,48 1000,74
         L 1000,100 Z"
      fill="#ffffff"
    />
  </svg>
);

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
  const [legalModalMode, setLegalModalMode] = useState<'privacy' | 'terms' | null>(null);

  // --- Validação inline em tempo real ---
  useEffect(() => {
    if (!email) { setEmailError(''); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailError(emailRegex.test(email) ? '' : 'E-mail inválido.');
  }, [email]);

  useEffect(() => {
    if (!password) { setPasswordError(''); return; }
    setPasswordError(password.length >= 8 ? '' : 'Mínimo 8 caracteres.');
  }, [password]);

  useEffect(() => {
    if (!resetEmail) { setResetEmailError(''); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setResetEmailError(emailRegex.test(resetEmail) ? '' : 'E-mail inválido.');
  }, [resetEmail]);

  // --- Helpers ---
  const translateAuthError = (message: string) => {
    const msg = message.toLowerCase();
    if (
      msg.includes('invalid login credentials') ||
      msg.includes('invalid credentials') ||
      msg.includes('user not found')
    ) {
      return 'E-mail ou senha incorretos. Tente novamente.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Confirme seu e-mail antes de fazer login.';
    }
    return 'Não foi possível entrar. Verifique suas credenciais e tente novamente.';
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
      gerente: '/agenda',
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
    if (!password || password.length < 8) {
      setPasswordError('A senha deve ter no mínimo 8 caracteres.');
      addToast('A senha precisa ter pelo menos 8 caracteres.', 'error');
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
      addToast(translateAuthError(error.message || ''), 'error');
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
      if (error) {
        console.warn('[Auth] Erro ao processar recuperação:', error.message);
      }

      addToast('Se o e-mail estiver cadastrado, o link de recuperação foi enviado.', 'success');
      setIsResetOpen(false);
      setResetEmail('');
    } catch {
      addToast('Se o e-mail estiver cadastrado, o link de recuperação foi enviado.', 'success');
    } finally {
      setResetLoading(false);
    }
  };

  const isSubmitDisabled = loading || !!emailError || !!passwordError;
  const isResetSubmitDisabled = resetLoading || !resetEmail || !!resetEmailError;

  return (
    <>
      {/* Textura sutil de ruído/grain */}
      <div className="noise-overlay" />

      <div className="login-replica-page">
        {/* ─── PAINEL ESQUERDO: DESTAQUE INSTITUCIONAL COM ONDAS (DESKTOP) ─── */}
        <div className="login-replica__hero" aria-label="Apresentação Navalhado">
          <div className="login-replica__hero-inner">
            <div className="login-replica__center-block">
              <img
                src="/simbolo.svg"
                alt="Navalhado"
                className="login-replica__logo"
              />
              <h1 className="login-replica__brand-title">Navalhado</h1>
              <p className="login-replica__brand-description">
                Gerencie sua barbearia com confiança. Agendamentos, comandas e métricas com precisão e sofisticação.
              </p>
            </div>
          </div>

          {/* Divisória vertical de nuvens/ondas orgânicas */}
          <VerticalCloudWave />
        </div>

        {/* ─── BANNER SUPERIOR MOBILE COM ONDAS HORIZONTAIS (< 1024px) ─── */}
        <div className="login-replica__hero-mobile" aria-label="Cabeçalho Navalhado">
          <div className="login-replica__hero-mobile-inner">
            <div className="login-replica__badge login-replica__badge--mobile">
              <img
                src="/simbolo.svg"
                alt="Navalhado"
                className="login-replica__logo login-replica__logo--mobile"
              />
            </div>
            <h1 className="login-replica__brand-title login-replica__brand-title--mobile">Navalhado</h1>
            <p className="login-replica__brand-description--mobile">
              Gerencie sua barbearia com confiança
            </p>
          </div>

          {/* Divisória horizontal de nuvens/ondas orgânicas */}
          <HorizontalCloudWave />
        </div>

        {/* ─── PAINEL DIREITO: FORMULÁRIO DE LOGIN ─── */}
        <div className="login-replica__form-panel">
          <div className="login-replica__form-wrapper">
            <div className="login-replica__form-header">
              <h2 className="login-replica__form-title">Acesse sua conta</h2>
              <p className="login-replica__form-subtitle">
                Informe suas credenciais para continuar
              </p>
            </div>

            {/* FORMULÁRIO */}
            <form onSubmit={handleLogin} className="login-replica__form">
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
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={passwordError}
                disabled={loading}
                required
              />

              {/* Esqueci a senha */}
              <div className="login-replica__forgot">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setIsResetOpen(true)}
                >
                  Esqueci a senha
                </button>
              </div>

              {/* Botão CTA Pílula */}
              <button
                type="submit"
                className="login-replica__cta-btn"
                disabled={isSubmitDisabled}
              >
                {loading ? (
                  <>
                    <div className="spinner spinner--sm" />
                    Entrando…
                  </>
                ) : (
                  <>
                    Acessar
                    <span className="btn__icon">
                      <ArrowRightIcon size={18} />
                    </span>
                  </>
                )}
              </button>

              {/* Rodapé: Criar conta & Links Legais com espaçamento refinado */}
              <div className="login-card__footer">
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

                <div className="login-card__legal-footer">
                  <button
                    type="button"
                    className="login-card__legal-btn"
                    onClick={() => setLegalModalMode('terms')}
                  >
                    Termos de uso
                  </button>
                  <span aria-hidden="true" className="login-card__legal-bullet">•</span>
                  <button
                    type="button"
                    className="login-card__legal-btn"
                    onClick={() => setLegalModalMode('privacy')}
                  >
                    Privacidade (LGPD)
                  </button>
                </div>
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

      {/* ─── ESTILOS DA PÁGINA (ISOLADOS & RESPONSIVOS) ─── */}
      <style>{`
        .login-replica-page {
          min-height: 100vh;
          min-height: 100dvh;
          background-color: #ffffff;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow-x: hidden;
        }

        @media (min-width: 1024px) {
          .login-replica-page {
            flex-direction: row;
            height: 100vh;
            height: 100dvh;
            overflow: hidden;
          }
        }

        /* ── Painel Esquerdo Desktop ── */
        .login-replica__hero {
          display: none;
        }

        @media (min-width: 1024px) {
          .login-replica__hero {
            display: flex;
            flex: 0 0 46%;
            width: 46%;
            height: 100%;
            background: linear-gradient(155deg, #1C1816 0%, #120F0E 100%);
            position: relative;
            box-sizing: border-box;
            overflow: hidden;
            z-index: 1;
          }

          .login-replica__hero-inner {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
            padding: 3.5rem 3rem;
            box-sizing: border-box;
            position: relative;
            z-index: 2;
            text-align: center;
            gap: 1.5rem;
          }
        }

        .login-replica__eyebrow {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.01em;
          text-transform: uppercase;
          margin: 0;
          line-height: 1.2;
        }

        .login-replica__center-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .login-replica__badge {
          width: auto;
          height: auto;
          border-radius: 0;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: none;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .login-replica__badge:hover {
          transform: scale(1.06);
        }

        .login-replica__logo {
          width: 64px;
          height: 64px;
          display: block;
          filter: drop-shadow(0 4px 16px rgba(217, 108, 0, 0.25));
        }

        .login-replica__brand-title {
          font-size: 2.25rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          letter-spacing: -0.02em;
          line-height: 1.15;
          text-align: center;
        }

        .login-replica__brand-description {
          font-size: 0.9375rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.72);
          margin: 0;
          max-width: 32ch;
          text-align: center;
          font-weight: 400;
        }

        /* Ondas Desktop */
        .login-wave-desktop {
          position: absolute;
          top: 0;
          bottom: 0;
          right: -1px;
          width: 100px;
          height: 100%;
          pointer-events: none;
          z-index: 3;
        }

        /* ── Banner Superior Mobile (< 1024px) ── */
        .login-replica__hero-mobile {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(160deg, #1C1816 0%, #120F0E 100%);
          position: relative;
          padding: 2.5rem 1.5rem 4rem;
          overflow: hidden;
          z-index: 1;
        }

        @media (min-width: 1024px) {
          .login-replica__hero-mobile {
            display: none;
          }
        }

        .login-replica__hero-mobile-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          position: relative;
          z-index: 2;
          text-align: center;
        }

        .login-replica__badge--mobile {
          width: auto;
          height: auto;
          box-shadow: none;
          background: transparent;
        }

        .login-replica__logo--mobile {
          width: 52px;
          height: 52px;
          filter: drop-shadow(0 4px 12px rgba(217, 108, 0, 0.25));
        }

        .login-replica__brand-title--mobile {
          font-size: 1.625rem;
          margin: 0;
        }

        .login-replica__brand-description--mobile {
          font-size: 0.8125rem;
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
          line-height: 1.4;
        }

        /* Ondas Mobile */
        .login-wave-mobile {
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          width: 100%;
          height: 52px;
          pointer-events: none;
          z-index: 3;
        }

        /* ── Painel do Formulário ── */
        .login-replica__form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1.25rem max(3rem, env(safe-area-inset-bottom, 3rem));
          box-sizing: border-box;
          background-color: #ffffff;
          z-index: 2;
        }

        @media (min-width: 1024px) {
          .login-replica__form-panel {
            flex: 0 0 54%;
            width: 54%;
            height: 100%;
            overflow-y: auto;
            padding: 3rem 2.5rem;
          }
        }

        .login-replica__form-wrapper {
          width: 100%;
          max-width: 390px;
          margin: auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          box-sizing: border-box;
          animation: smoothFadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .login-replica__form-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.375rem;
        }

        .login-replica__form-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
          letter-spacing: -0.025em;
          margin: 0;
        }

        .login-replica__form-subtitle {
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-secondary, #70625B);
          margin: 0;
        }

        .login-replica__form {
          display: flex;
          flex-direction: column;
          gap: 1.125rem;
          width: 100%;
        }

        .login-replica__form input {
          border: 0 !important;
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #2D231E) !important;
        }

        .login-replica__form input:focus {
          box-shadow: 0 0 0 1.5px var(--color-brand-primary, #D96C00) !important;
        }

        .login-replica__forgot {
          display: flex;
          justify-content: flex-end;
          margin-top: -0.375rem;
        }

        .login-replica__forgot .btn--ghost {
          color: var(--color-text-primary, #2D231E) !important;
          font-weight: 600;
        }

        /* Botão CTA Pílula */
        .login-replica__cta-btn {
          width: 100%;
          min-height: 48px;
          padding: 0.875rem 1.5rem;
          border-radius: var(--radius-full, 9999px);
          background: linear-gradient(135deg, #E67200 0%, #D96C00 100%);
          color: #ffffff;
          border: none;
          font-weight: 600;
          font-size: var(--font-size-base, 1rem);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          cursor: pointer;
          box-shadow: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .login-replica__cta-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: none;
          background: linear-gradient(135deg, #EB7804 0%, #E06F00 100%);
        }

        .login-replica__cta-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-replica__cta-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* ─── Footer com Cadastro & Links Legais ─── */
        .login-card__footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          margin-top: 0.25rem;
          padding-top: 0.5rem;
          width: 100%;
        }

        .login-card__signup {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.25rem 0;
          position: static !important;
          top: auto !important;
          left: auto !important;
          transform: none !important;
        }

        .login-card__signup-text {
          font-size: var(--font-size-xs, 0.8125rem);
          color: var(--color-text-secondary, #70625B);
        }

        .login-card__signup-btn {
          font-size: var(--font-size-xs, 0.8125rem) !important;
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.5rem;
          color: var(--color-text-primary, #2D231E) !important;
          font-weight: 700 !important;
        }

        .login-card__legal-footer {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.75rem;
          color: var(--color-text-tertiary, #9C8E85);
          position: static !important;
          top: auto !important;
          left: auto !important;
          transform: none !important;
        }

        .login-card__legal-bullet {
          color: var(--color-text-tertiary, #9C8E85);
          opacity: 0.6;
          user-select: none;
        }

        .login-card__legal-btn {
          background: none;
          border: none;
          padding: 0.25rem 0.5rem;
          color: var(--color-text-primary, #2D231E) !important;
          text-decoration: underline;
          text-underline-offset: 2px;
          cursor: pointer;
          font-size: 0.75rem;
          min-height: 32px;
          display: inline-flex;
          align-items: center;
          transition: opacity 0.15s ease;
        }

        .login-card__legal-btn:hover {
          opacity: 0.75;
        }

        .btn--ghost {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
        }

        /* ── Modal de Recuperação ── */
        .modal-reset {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          animation: smoothFadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 0.05s;
        }

        .modal-reset__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 3rem;
          border-radius: var(--radius-full);
          background: var(--color-brand-lightest, #FFF1E6);
          color: var(--color-brand-primary, #D96C00);
          box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.5),
            0 4px 12px rgba(217, 108, 0, 0.1);
          margin-bottom: 0.25rem;
        }

        .modal-reset__description {
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-secondary, #70625B);
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
          min-height: 44px;
        }

        /* Animações e Acessibilidade */
        @keyframes smoothFadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-replica__form-wrapper,
          .modal-reset {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default Login;
