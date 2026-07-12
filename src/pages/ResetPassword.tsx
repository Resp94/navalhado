import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { Input } from '../components/Input';
import { ScissorsIcon, ArrowRightIcon, WarningIcon } from '../components/Icons';

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
    setPasswordError(password.length >= 6 ? '' : 'Mínimo 6 caracteres.');
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
    if (password.length >= 6) score++;
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

    if (!password || password.length < 6) {
      setPasswordError('A senha deve ter no mínimo 6 caracteres.');
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
        <div className="reset-page">
          <div className="reset-page__bg" />
          <div className="reset-card__shell">
            <div className="reset-card reset-card--loading">
              <div className="spinner spinner--lg" />
              <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>
                Validando link de recuperação...
              </p>
            </div>
          </div>
        </div>
        <style>{styles}</style>
      </>
    );
  }

  // Caso o usuário tente acessar sem sessão de recuperação
  if (!hasSession) {
    return (
      <>
        <div className="noise-overlay" />
        <div className="reset-page">
          <div className="reset-page__bg" />
          <div className="reset-card__shell">
            <div className="reset-card reset-card--error">
              <div className="reset-card__error-icon">
                <WarningIcon size={40} />
              </div>
              <h1 className="reset-card__title">Link Inválido</h1>
              <p className="reset-card__subtitle" style={{ lineHeight: '1.5', marginTop: '0.25rem' }}>
                Este link de redefinição de senha expirou ou é inválido. Por favor, solicite um novo link a partir da tela de login.
              </p>
              <button
                onClick={() => navigate('/')}
                className="btn btn--primary"
                style={{ width: '100%', marginTop: '0.75rem' }}
              >
                Voltar para o Login
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
      <div className="reset-page">
        <div className="reset-page__bg" />

        <div className="reset-card__shell">
          <div className="reset-card">
            {/* Header do Card */}
            <div className="reset-card__header">
              <span className="reset-card__eyebrow">segurança</span>
              <div className="reset-card__icon">
                <ScissorsIcon size={28} />
              </div>
              <h1 className="reset-card__title">Nova senha</h1>
              <p className="reset-card__subtitle">
                Digite sua nova credencial de acesso
              </p>
            </div>

            {/* Formulário */}
            <form onSubmit={handleReset} className="reset-card__form">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <Input
                  label="Nova Senha"
                  type="password"
                  icon="lock"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={passwordError}
                  disabled={loading}
                  required
                />
                {password && (
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
                className="btn btn--primary reset-card__cta"
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
      <style>{styles}</style>
    </>
  );
};

const styles = `
.reset-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
}

.reset-page__bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 85% 55% at 50% 30%, rgba(217, 108, 0, 0.07) 0%, transparent 65%),
    radial-gradient(ellipse 55% 45% at 80% 80%, rgba(242, 178, 119, 0.08) 0%, transparent 55%);
  pointer-events: none;
}

.reset-card__shell {
  width: 100%;
  max-width: 420px;
  padding: 6px;
  border-radius: calc(var(--radius-xl) + 6px);
  background: rgba(217, 108, 0, 0.04);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4);
  animation: springUp 0.6s cubic-bezier(0.32, 0.72, 0, 1) both;
}

.reset-card {
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

.reset-card--loading {
  padding: 3rem 2rem;
  align-items: center;
  justify-content: center;
}

.reset-card--error {
  padding: 3rem 2rem;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
}

.reset-card__error-icon {
  background: var(--color-error-bg);
  color: var(--color-error);
  padding: 1rem;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(240, 82, 82, 0.15);
}

.reset-card__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  animation: springUp 0.5s cubic-bezier(0.32, 0.72, 0, 1) both;
  animation-delay: 0.08s;
}

.reset-card__eyebrow {
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

.reset-card__icon {
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

.reset-card__icon svg {
  transform: rotate(-45deg);
}

.reset-card__title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.03em;
  margin: 0;
}

.reset-card__subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  font-weight: 400;
}

.reset-card__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  animation: springUp 0.5s cubic-bezier(0.32, 0.72, 0, 1) both;
  animation-delay: 0.16s;
}

.reset-card__cta {
  width: 100%;
  padding: 0.85rem 1.5rem;
  font-size: var(--font-size-base);
  margin-top: 0.5rem;
}

.pwd-strength-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.125rem;
  text-align: left;
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

.spinner--lg {
  width: 32px;
  height: 32px;
  border-width: 3px;
  border-top-color: var(--color-brand-primary);
}

@media (max-width: 480px) {
  .reset-card__shell {
    padding: 4px;
    border-radius: var(--radius-xl);
  }
  .reset-card {
    padding: 2rem 1.25rem 1.75rem;
    border-radius: calc(var(--radius-xl) - 2px);
  }
}
`;
