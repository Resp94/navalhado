import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { LegalModal } from '../components/legal/LegalModal';
import { ArrowRightIcon, LockIcon } from '../components/Icons';
import { isValidEmailFormat } from '../lib/email';

/* ─── Ondas SVG Orgânicas em Camadas ─── */
const VerticalCloudWave: React.FC = () => (
  <svg
    className="absolute top-0 bottom-0 -right-px w-[100px] h-full pointer-events-none z-3"
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
    className="absolute -bottom-px inset-x-0 w-full h-[52px] pointer-events-none z-3"
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

  const [emailNaoConfirmado, setEmailNaoConfirmado] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetEmailError, setResetEmailError] = useState('');
  const [legalModalMode, setLegalModalMode] = useState<'privacy' | 'terms' | null>(null);

  // --- Validação inline em tempo real ---
  useEffect(() => {
    if (!email) { setEmailError(''); return; }
    setEmailError(isValidEmailFormat(email) ? '' : 'E-mail inválido.');
    setEmailNaoConfirmado(false);
  }, [email]);

  useEffect(() => {
    if (!password) { setPasswordError(''); return; }
    setPasswordError(password.length >= 8 ? '' : 'Mínimo 8 caracteres.');
  }, [password]);

  useEffect(() => {
    if (!resetEmail) { setResetEmailError(''); return; }
    setResetEmailError(isValidEmailFormat(resetEmail) ? '' : 'E-mail inválido.');
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
      const msg = (error.message || '').toLowerCase();
      setEmailNaoConfirmado(msg.includes('email not confirmed'));
      addToast(translateAuthError(error.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setResendingConfirmation(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      addToast('Link de confirmação reenviado. Confira seu e-mail.', 'success');
    } catch {
      addToast('Não foi possível reenviar o link agora. Tente novamente em instantes.', 'error');
    } finally {
      setResendingConfirmation(false);
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

      <div className="min-h-screen min-h-dvh bg-white flex flex-col relative overflow-x-hidden lg:flex-row lg:h-screen lg:h-dvh lg:overflow-hidden">
        {/* ─── PAINEL ESQUERDO: DESTAQUE INSTITUCIONAL COM ONDAS (DESKTOP) ─── */}
        <div
          className="hidden relative z-1 overflow-hidden box-border lg:flex lg:flex-none lg:w-[46%] lg:h-full bg-[linear-gradient(155deg,#1C1816_0%,#120F0E_100%)]"
          aria-label="Apresentação Navalhado"
        >
          <div className="hidden lg:flex lg:flex-col lg:justify-center lg:items-center lg:w-full lg:h-full lg:px-12 lg:py-14 relative z-2 text-center gap-6">
            <div className="flex flex-col items-center gap-4">
              <img
                src="/simbolo.svg"
                alt="Navalhado"
                className="w-16 h-16 block [filter:drop-shadow(0_4px_16px_rgba(217,108,0,0.25))]"
              />
              <h1 className="text-[2.25rem] font-bold text-white m-0 tracking-[-0.02em] leading-[1.15] text-center">
                Navalhado
              </h1>
              <p className="text-[0.9375rem] leading-[1.6] text-white/[0.72] m-0 max-w-[32ch] text-center font-normal">
                Gerencie sua barbearia com confiança. Agendamentos, comandas e métricas com precisão e sofisticação.
              </p>
            </div>
          </div>

          {/* Divisória vertical de nuvens/ondas orgânicas */}
          <VerticalCloudWave />
        </div>

        {/* ─── BANNER SUPERIOR MOBILE COM ONDAS HORIZONTAIS (< 1024px) ─── */}
        <div
          className="flex flex-col items-center justify-center relative overflow-hidden z-1 px-6 pt-10 pb-16 bg-[linear-gradient(160deg,#1C1816_0%,#120F0E_100%)] lg:hidden"
          aria-label="Cabeçalho Navalhado"
        >
          <div className="flex flex-col items-center gap-2 relative z-2 text-center">
            <div className="w-auto h-auto shadow-none bg-transparent flex items-center justify-center transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.06]">
              <img
                src="/simbolo.svg"
                alt="Navalhado"
                className="w-[52px] h-[52px] block [filter:drop-shadow(0_4px_12px_rgba(217,108,0,0.25))]"
              />
            </div>
            <h1 className="text-[1.625rem] font-bold text-white m-0 tracking-[-0.02em] leading-[1.15] text-center">
              Navalhado
            </h1>
            <p className="text-[0.8125rem] text-white/70 m-0 leading-[1.4]">
              Gerencie sua barbearia com confiança
            </p>
          </div>

          {/* Divisória horizontal de nuvens/ondas orgânicas */}
          <HorizontalCloudWave />
        </div>

        {/* ─── PAINEL DIREITO: FORMULÁRIO DE LOGIN ─── */}
        <div className="flex-1 flex items-center justify-center px-5 pt-8 [padding-bottom:max(3rem,env(safe-area-inset-bottom,3rem))] box-border bg-white z-2 lg:flex-none lg:w-[54%] lg:h-full lg:overflow-y-auto lg:px-10 lg:py-12">
          <div className="w-full max-w-[390px] mx-auto flex flex-col gap-6 box-border [animation:slideUp_0.45s_cubic-bezier(0.16,1,0.3,1)_both]">
            <div className="flex flex-col items-center text-center gap-1.5">
              <h2 className="text-[1.75rem] font-bold text-text-primary tracking-[-0.025em] m-0">Acesse sua conta</h2>
              <p className="text-sm text-text-secondary m-0">
                Informe suas credenciais para continuar
              </p>
            </div>

            {/* FORMULÁRIO */}
            {/* !important nos inputs: sobrepõe o style inline do componente Input
                (fora do escopo desta migração) para trocar borda por box-shadow fino. */}
            <form
              onSubmit={handleLogin}
              className="flex flex-col gap-[1.125rem] w-full [&_input]:!border-0 [&_input]:!shadow-[0_0_0_0.5px_var(--color-text-primary)] [&_input:focus]:!shadow-[0_0_0_1.5px_var(--color-brand-primary)]"
            >
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
              <div className="flex justify-end -mt-1.5">
                <button
                  type="button"
                  className="btn btn--ghost min-h-9 inline-flex items-center !text-text-primary font-semibold"
                  onClick={() => setIsResetOpen(true)}
                >
                  Esqueci a senha
                </button>
              </div>

              {/* E-mail não confirmado: reenviar link (spec 047, ticket 10) */}
              {emailNaoConfirmado && (
                <div className="flex justify-end -mt-1.5">
                  <button
                    type="button"
                    className="btn btn--ghost min-h-9 inline-flex items-center !text-text-primary font-semibold"
                    onClick={handleResendConfirmation}
                    disabled={resendingConfirmation}
                  >
                    Reenviar link
                  </button>
                </div>
              )}

              {/* Botão CTA Pílula */}
              <button
                type="submit"
                className="w-full min-h-12 px-6 py-[0.875rem] rounded-full text-white border-none font-semibold text-base flex items-center justify-center gap-2 cursor-pointer shadow-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] bg-[linear-gradient(135deg,#E67200_0%,#D96C00_100%)] hover:not-disabled:-translate-y-px hover:not-disabled:bg-[linear-gradient(135deg,#EB7804_0%,#E06F00_100%)] active:not-disabled:translate-y-0 disabled:opacity-55 disabled:cursor-not-allowed"
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
              <div className="flex flex-col items-center gap-3 mt-1 pt-2 w-full">
                <div className="flex items-center justify-center gap-2 py-1 static">
                  <span className="text-xs text-text-secondary">
                    Não tem conta?{' '}
                  </span>
                  <button
                    type="button"
                    className="btn btn--link min-h-9 inline-flex items-center px-2 py-1 !text-text-primary !font-bold"
                    onClick={() => navigate('/signup')}
                  >
                    Criar conta
                  </button>
                </div>

                <div className="flex justify-center items-center gap-3 text-xs text-[var(--color-text-tertiary,#9C8E85)] static">
                  <button
                    type="button"
                    className="bg-none border-none px-2 py-1 text-text-primary underline underline-offset-2 cursor-pointer text-xs min-h-8 inline-flex items-center transition-opacity duration-150 hover:opacity-75"
                    onClick={() => setLegalModalMode('terms')}
                  >
                    Termos de uso
                  </button>
                  <span aria-hidden="true" className="text-[var(--color-text-tertiary,#9C8E85)] opacity-60 select-none">•</span>
                  <button
                    type="button"
                    className="bg-none border-none px-2 py-1 text-text-primary underline underline-offset-2 cursor-pointer text-xs min-h-8 inline-flex items-center transition-opacity duration-150 hover:opacity-75"
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
        <div className="flex flex-col items-center gap-4 [animation:slideUp_0.35s_cubic-bezier(0.16,1,0.3,1)_both] [animation-delay:0.05s]">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-brand-lightest text-brand-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_4px_12px_rgba(217,108,0,0.1)] mb-1">
            <LockIcon size={22} />
          </div>

          <p className="text-sm text-text-secondary leading-[1.6] m-0 text-center max-w-[32ch]">
            Digite seu e-mail e enviaremos um link seguro para criar uma nova senha.
          </p>

          <form onSubmit={handleResetPassword} className="flex flex-col gap-5 w-full mt-2">
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
              className="btn btn--primary w-full min-h-11"
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
    </>
  );
};

export default Login;
