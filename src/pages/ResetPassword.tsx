import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { Input } from '../components/Input';
import { ArrowRightIcon, WarningIcon } from '../components/Icons';

const PAGE_CLASS =
  'min-h-screen min-h-dvh flex items-center justify-center p-6 relative overflow-hidden ' +
  'max-md:px-[0.875rem] max-md:py-4 max-md:items-start ' +
  'max-md:pt-[max(1.5rem,env(safe-area-inset-top,1.5rem))] max-md:pb-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))] ' +
  'max-md:overflow-y-auto max-md:[-webkit-overflow-scrolling:touch]';

const SHELL_CLASS =
  'w-full max-w-[420px] p-[6px] rounded-[calc(var(--radius-xl)+6px)] bg-[rgba(217,108,0,0.04)] ' +
  'shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] [animation:slideUp_0.45s_cubic-bezier(0.16,1,0.3,1)_both] ' +
  'max-md:p-0.5 max-md:rounded-xl max-md:my-auto max-md:mx-0';

const CARD_CLASS =
  'bg-bg-secondary rounded-xl w-full text-center flex flex-col gap-7 relative ' +
  'shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_1px_2px_rgba(45,35,30,0.04),var(--shadow-lg)] ' +
  'pt-10 px-8 pb-8 max-md:pt-7 max-md:px-5 max-md:pb-6 max-md:rounded-[calc(var(--radius-xl)-2px)] max-md:gap-5';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  // --- Verificar Sessão de Recuperação no Carregamento ---
  useEffect(() => {
    // 1. Checa a sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasSession(true);
      }
      setCheckingSession(false);
    });

    // 2. Escuta mudanças no estado de autenticação (ex: quando o link do e-mail é consumido)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasSession(true);
      } else if (!session) {
        setHasSession(false);
      }
      setCheckingSession(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // --- Validações em tempo real ---
  useEffect(() => {
    if (!password) { setPasswordError(''); return; }
    setPasswordError(password.length >= 8 ? '' : 'Mínimo 8 caracteres.');
  }, [password]);

  useEffect(() => {
    if (!confirmPassword) { setConfirmPasswordError(''); return; }
    setConfirmPasswordError(
      password === confirmPassword ? '' : 'As senhas não coincidem.'
    );
  }, [password, confirmPassword]);

  // --- Força da Senha ---
  const getPasswordStrength = () => {
    if (!password) return { score: 0, text: '', color: 'transparent' };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score, text: 'Fraca', color: 'var(--color-error)' };
    if (score === 2) return { score, text: 'Média', color: 'var(--color-warning)' };
    return { score, text: 'Forte', color: 'var(--color-success)' };
  };

  const pwdStrength = getPasswordStrength();

  // --- Submissão do Formulário ---
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 8) {
      setPasswordError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      // Atualiza a senha no Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      addToast('Senha atualizada com sucesso!', 'success');

      // Limpa a sessão temporária de recuperação deslogando
      await supabase.auth.signOut();

      // Redireciona para o login
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error: any) {
      addToast(error.message || 'Erro ao redefinir a senha.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = loading || !password || !confirmPassword || !!passwordError || !!confirmPasswordError;

  if (checkingSession) {
    return (
      <>
        <div className="noise-overlay" />
        <div className={PAGE_CLASS}>
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_85%_55%_at_50%_30%,rgba(217,108,0,0.07)_0%,transparent_65%),radial-gradient(ellipse_55%_45%_at_80%_80%,rgba(242,178,119,0.08)_0%,transparent_55%)]" />
          <div className={SHELL_CLASS}>
            <div className={`${CARD_CLASS} items-center justify-center`}>
              <div className="spinner w-8 h-8 border-[3px] border-t-brand-primary" />
              <p className="mt-4 text-text-secondary">
                Validando link de recuperação...
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Caso o usuário tente acessar sem sessão de recuperação
  if (!hasSession) {
    return (
      <>
        <div className="noise-overlay" />
        <div className={PAGE_CLASS}>
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_85%_55%_at_50%_30%,rgba(217,108,0,0.07)_0%,transparent_65%),radial-gradient(ellipse_55%_45%_at_80%_80%,rgba(242,178,119,0.08)_0%,transparent_55%)]" />
          <div className={SHELL_CLASS}>
            <div className={`${CARD_CLASS} items-center justify-center gap-5`}>
              <div className="flex items-center justify-center bg-error-bg text-error p-4 rounded-full shadow-[0_4px_12px_rgba(240,82,82,0.15)]">
                <WarningIcon size={40} />
              </div>
              <h1 className="text-2xl font-bold text-text-primary tracking-[-0.03em] m-0">Link Inválido</h1>
              <p className="text-sm text-text-secondary m-0 font-normal leading-[1.5] mt-1">
                Este link de redefinição de senha expirou ou é inválido. Por favor, solicite um novo link a partir da tela de login.
              </p>
              <button
                onClick={() => navigate('/')}
                className="btn btn--primary w-full mt-3"
              >
                Voltar para o Login
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
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_85%_55%_at_50%_30%,rgba(217,108,0,0.07)_0%,transparent_65%),radial-gradient(ellipse_55%_45%_at_80%_80%,rgba(242,178,119,0.08)_0%,transparent_55%)]" />

        <div className={SHELL_CLASS}>
          <div className={CARD_CLASS}>
            {/* Header do Card */}
            <div className="flex flex-col items-center gap-1.5 [animation:slideUp_0.4s_cubic-bezier(0.16,1,0.3,1)_both] [animation-delay:0.05s]">
              <span className="inline-block px-3 py-1 rounded-full bg-brand-lightest text-brand-primary text-[0.625rem] font-semibold uppercase tracking-[0.2em] mb-1">
                segurança
              </span>
              <div className="bg-brand-lightest p-[0.875rem] rounded-full flex items-center justify-center text-brand-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_4px_14px_rgba(217,108,0,0.12)] mb-1">
                <img src="/simbolo.svg" alt="Navalhado" className="w-[50px] h-[50px] block" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary tracking-[-0.03em] m-0">Nova senha</h1>
              <p className="text-sm text-text-secondary m-0 font-normal">
                Digite sua nova credencial de acesso
              </p>
            </div>

            {/* Formulário */}
            <form
              onSubmit={handleReset}
              className="flex flex-col gap-5 [animation:slideUp_0.4s_cubic-bezier(0.16,1,0.3,1)_both] [animation-delay:0.1s]"
            >
              <div className="flex flex-col gap-1">
                <Input
                  label="Nova Senha"
                  type="password"
                  icon="lock"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={passwordError}
                  disabled={loading}
                  required
                />
                {password && (
                  <div className="flex items-center gap-2 mt-0.5 text-left">
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

              <Input
                label="Confirmar Nova Senha"
                type="password"
                icon="lock"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={confirmPasswordError}
                disabled={loading}
                required
              />

              <button
                type="submit"
                className="btn btn--primary w-full py-[0.85rem] px-6 text-base mt-2 max-md:min-h-12"
                disabled={isSubmitDisabled}
              >
                {loading ? (
                  <>
                    <div className="spinner" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    Atualizar Senha
                    <span className="btn__icon">
                      <ArrowRightIcon size={16} />
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};
