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
      className="relative flex items-center justify-center min-h-dvh p-6 font-base bg-bg-primary bg-[radial-gradient(ellipse_80%_60%_at_50%_20%,rgba(217,108,0,0.07)_0%,transparent_70%),radial-gradient(ellipse_120%_80%_at_80%_80%,rgba(217,108,0,0.04)_0%,transparent_60%)]"
    >
      {/* ═══ NOISE / GRAIN OVERLAY ═══ */}
      <div className="noise-overlay" />

      {/* ═══ DOUBLE-BEZEL OUTER SHELL ═══ */}
      <div
        ref={shellRef}
        className="opacity-0 bg-[rgba(45,35,30,0.04)] p-[10px] rounded-[2rem] border border-[rgba(45,35,30,0.06)] max-w-[480px] w-full shadow-[0_24px_48px_-16px_rgba(45,35,30,0.1)]"
      >
        {/* ═══ DOUBLE-BEZEL INNER CORE ═══ */}
        <div className="bg-bg-secondary rounded-[calc(2rem-10px)] text-center flex flex-col items-center gap-7 pt-13 px-9 pb-11 border border-white/75 shadow-[inset_0_1px_2px_rgba(255,255,255,0.85)]">
          {/* ── Eyebrow Tag ── */}
          <span
            ref={eyebrowRef}
            className="text-[0.625rem] uppercase tracking-[0.28em] font-bold text-brand-primary bg-brand-lightest px-4 py-1.5 rounded-full border border-[rgba(217,108,0,0.12)]"
          >
            Link expirado
          </span>

          {/* ── Icon Circle ── */}
          <div
            ref={iconRef}
            className="w-[88px] h-[88px] rounded-full bg-error-bg text-error flex items-center justify-center border border-[rgba(240,82,82,0.18)] shadow-[0_12px_28px_-8px_rgba(240,82,82,0.18),inset_0_2px_4px_rgba(240,82,82,0.04)]"
          >
            <HugeiconsIcon icon={CancelCircleIcon} size={44} strokeWidth={1.2} />
          </div>

          {/* ── Title & Description ── */}
          <div ref={textRef} className="flex flex-col gap-[0.85rem] max-w-[400px]">
            <h1 className="text-[1.75rem] font-extrabold text-text-primary m-0 tracking-[-0.025em] leading-[1.15]">
              Link de acesso expirado
            </h1>
            <p className="text-base text-text-secondary leading-[1.7] m-0">
              Links temporários expiram para proteger seus dados. Para voltar a
              agendar horários na{' '}
              <strong className="text-text-primary font-semibold">
                {tenantName}
              </strong>
              , peça um novo link pelo WhatsApp.
            </p>
          </div>

          {/* ── Info Card (nested bezel) ── */}
          <div
            ref={infoCardRef}
            className="w-full bg-[rgba(234,222,214,0.2)] rounded-[18px] py-[1.35rem] px-6 border border-[rgba(45,35,30,0.06)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
          >
            <div className="flex items-center justify-center gap-2 font-bold text-sm text-text-primary mb-[0.85rem]">
              <HugeiconsIcon
                icon={AlertCircleIcon}
                size={18}
                strokeWidth={2}
                color="var(--color-brand-primary)"
              />
              Como receber um novo link
            </div>
            <div className="flex flex-col items-center gap-2 text-sm text-text-secondary leading-[1.6]">
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
            className="flex items-center justify-center gap-3 w-full bg-[#25D366] text-white no-underline font-bold text-base py-2.5 px-6 rounded-full cursor-pointer border-none outline-none [will-change:transform,box-shadow]"
          >
            <span>Falar no WhatsApp</span>

            {/* Trailing icon wrapper — button-in-button */}
            <div
              ref={btnIconRef}
              className="w-[38px] h-[38px] rounded-full bg-white/15 flex items-center justify-center shrink-0 [will-change:transform]"
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
          <p ref={footerRef} className="text-xs text-text-secondary m-0 tracking-[0.01em]">
            Se precisar de ajuda, entre em contato direto com a barbearia.
          </p>
        </div>
      </div>
    </div>
  );
};
