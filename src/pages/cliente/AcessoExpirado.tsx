import React, { useRef, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { 
  CancelCircleIcon, 
  AlertCircleIcon,
  ArrowRight01Icon
} from '@hugeicons/core-free-icons';
import gsap from 'gsap';

export const AcessoExpirado: React.FC = () => {
  // ── Refs for GSAP animations ──
  const shellRef = useRef<HTMLDivElement>(null);
  const eyebrowRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const infoCardRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const footerRef = useRef<HTMLParagraphElement>(null);
  const btnIconRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // ── Tenant info from localStorage ──
  const tenantName = localStorage.getItem('navalhado_tenant_name') || 'nossa barbearia';
  const tenantPhone = localStorage.getItem('navalhado_tenant_phone') || '';

  // Clean up expired token
  localStorage.removeItem('navalhado_customer_token');

  // ── WhatsApp link formatting ──
  const cleanPhone = tenantPhone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.length === 11 ? `55${cleanPhone}` : cleanPhone;
  const message = encodeURIComponent(
    `Olá! Meu link de agendamento na ${tenantName} expirou. Pode me enviar um novo, por favor?`
  );
  const whatsappUrl = formattedPhone
    ? `https://wa.me/${formattedPhone}?text=${message}`
    : `https://wa.me/?text=${message}`;

  // ──────────────────────────────────────────────
  //  GSAP ENTRY ANIMATION — Spring stagger reveal
  // ──────────────────────────────────────────────
  useEffect(() => {
    const ctx = gsap.context(() => {
      const shell = shellRef.current;
      if (!shell) return;

      const tl = gsap.timeline({
        defaults: { ease: 'cubic-bezier(0.32, 0.72, 0, 1)' },
      });

      // 1. Card springs up from below
      tl.fromTo(
        shell,
        { y: 60, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, duration: 1.1 },
      );

      // 2. Inner elements stagger in
      const innerElements = [
        eyebrowRef.current,
        iconRef.current,
        textRef.current,
        infoCardRef.current,
        ctaRef.current,
        footerRef.current,
      ].filter(Boolean);

      tl.fromTo(
        innerElements,
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.07, duration: 0.7 },
        '-=0.45',
      );
    }, pageRef);

    return () => ctx.revert();
  }, []);

  // ──────────────────────────────────────────────
  //  MAGNETIC BUTTON — GSAP hover physics
  // ──────────────────────────────────────────────
  const handleCtaEnter = () => {
    const btn = ctaRef.current;
    const icon = btnIconRef.current;
    if (!btn) return;

    gsap.to(btn, {
      scale: 1.03,
      backgroundColor: '#128C7E',
      boxShadow: '0 12px 36px -6px rgba(37, 211, 102, 0.45)',
      duration: 0.45,
      ease: 'cubic-bezier(0.32, 0.72, 0, 1)',
    });

    if (icon) {
      gsap.to(icon, {
        x: 4,
        y: -3,
        scale: 1.1,
        backgroundColor: 'rgba(255, 255, 255, 0.22)',
        duration: 0.45,
        ease: 'cubic-bezier(0.32, 0.72, 0, 1)',
      });
    }
  };

  const handleCtaLeave = () => {
    const btn = ctaRef.current;
    const icon = btnIconRef.current;
    if (!btn) return;

    gsap.to(btn, {
      scale: 1,
      backgroundColor: '#25D366',
      boxShadow: '0 8px 24px -4px rgba(37, 211, 102, 0.35)',
      duration: 0.5,
      ease: 'cubic-bezier(0.32, 0.72, 0, 1)',
    });

    if (icon) {
      gsap.to(icon, {
        x: 0,
        y: 0,
        scale: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        duration: 0.5,
        ease: 'cubic-bezier(0.32, 0.72, 0, 1)',
      });
    }
  };

  const handleCtaMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const deltaX = (e.clientX - rect.left - centerX) / centerX;
    const deltaY = (e.clientY - rect.top - centerY) / centerY;

    gsap.to(btn, {
      boxShadow: `0 12px 36px -6px rgba(37, 211, 102, ${0.35 + Math.abs(deltaX) * 0.12})`,
      duration: 0.5,
      ease: 'power2.out',
    });

    if (btnIconRef.current) {
      gsap.to(btnIconRef.current, {
        x: 4 + deltaX * 2,
        y: -3 + deltaY * 1.5,
        duration: 0.5,
        ease: 'power2.out',
      });
    }
  };

  // ──────────────────────────────────────────────
  //  RENDER
  // ──────────────────────────────────────────────
  return (
    <div
      ref={pageRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        padding: '1.5rem',
        fontFamily: 'var(--font-family-base)',
        background: `
          radial-gradient(ellipse 80% 60% at 50% 20%, rgba(217, 108, 0, 0.07) 0%, transparent 70%),
          radial-gradient(ellipse 120% 80% at 80% 80%, rgba(217, 108, 0, 0.04) 0%, transparent 60%),
          var(--color-bg-primary)
        `,
      }}
    >
      {/* ═══ NOISE / GRAIN OVERLAY ═══ */}
      <div className="noise-overlay" />

      {/* ═══ DOUBLE-BEZEL OUTER SHELL ═══ */}
      <div
        ref={shellRef}
        style={{
          opacity: 0, /* hidden until GSAP reveals */
          backgroundColor: 'rgba(45, 35, 30, 0.04)',
          padding: '10px',
          borderRadius: '2rem',
          border: '1px solid rgba(45, 35, 30, 0.06)',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 24px 48px -16px rgba(45, 35, 30, 0.1)',
        }}
      >
        {/* ═══ DOUBLE-BEZEL INNER CORE ═══ */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'calc(2rem - 10px)',
            padding: '3.25rem 2.25rem 2.75rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.75rem',
            border: '1px solid rgba(255, 255, 255, 0.75)',
            boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.85)',
          }}
        >
          {/* ── Eyebrow Tag ── */}
          <span
            ref={eyebrowRef}
            style={{
              fontSize: '0.625rem',
              textTransform: 'uppercase',
              letterSpacing: '0.28em',
              fontWeight: 700,
              color: 'var(--color-brand-primary)',
              backgroundColor: 'var(--color-brand-lightest)',
              padding: '6px 16px',
              borderRadius: '9999px',
              border: '1px solid rgba(217, 108, 0, 0.12)',
            }}
          >
            Link expirado
          </span>

          {/* ── Icon Circle ── */}
          <div
            ref={iconRef}
            style={{
              width: '88px',
              height: '88px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-error-bg)',
              color: 'var(--color-error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `
                0 12px 28px -8px rgba(240, 82, 82, 0.18),
                inset 0 2px 4px rgba(240, 82, 82, 0.04)
              `,
              border: '1px solid rgba(240, 82, 82, 0.18)',
            }}
          >
            <HugeiconsIcon icon={CancelCircleIcon} size={44} strokeWidth={1.2} />
          </div>

          {/* ── Title & Description ── */}
          <div
            ref={textRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              maxWidth: '400px',
            }}
          >
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
                margin: 0,
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
              }}
            >
              Link de acesso expirado
            </h1>
            <p
              style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              Links temporários expiram para proteger seus dados. Para voltar a
              agendar horários na{' '}
              <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                {tenantName}
              </strong>
              , peça um novo link pelo WhatsApp.
            </p>
          </div>

          {/* ── Info Card (nested bezel) ── */}
          <div
            ref={infoCardRef}
            style={{
              width: '100%',
              backgroundColor: 'rgba(234, 222, 214, 0.2)',
              borderRadius: '18px',
              padding: '1.35rem 1.5rem',
              border: '1px solid rgba(45, 35, 30, 0.06)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontWeight: 700,
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-primary)',
                marginBottom: '0.85rem',
              }}
            >
              <HugeiconsIcon
                icon={AlertCircleIcon}
                size={18}
                strokeWidth={2}
                color="var(--color-brand-primary)"
              />
              Como receber um novo link
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
              }}
            >
              <span>Abra o WhatsApp com um clique.</span>
              <span>Confirme seus dados na conversa.</span>
              <span>Pronto, você recebe o novo link na hora.</span>
            </div>
          </div>

          {/* ── Primary CTA — Apple-esque Pill with Trailing Icon ── */}
          <a
            ref={ctaRef}
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={handleCtaEnter}
            onMouseLeave={handleCtaLeave}
            onMouseMove={handleCtaMove}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              width: '100%',
              backgroundColor: '#25D366',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 'var(--font-size-base)',
              padding: '10px 24px',
              borderRadius: '9999px',
              cursor: 'pointer',
              border: 'none',
              outline: 'none',
              willChange: 'transform, box-shadow',
            }}
          >
            <span>Falar no WhatsApp</span>

            {/* Trailing icon wrapper — button-in-button */}
            <div
              ref={btnIconRef}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                willChange: 'transform',
              }}
            >
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={20}
                strokeWidth={2.5}
                color="#FFFFFF"
              />
            </div>
          </a>

          {/* ── Footer text ── */}
          <p
            ref={footerRef}
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              margin: 0,
              letterSpacing: '0.01em',
            }}
          >
            Se precisar de ajuda, entre em contato direto com a barbearia.
          </p>
        </div>
      </div>
    </div>
  );
};
