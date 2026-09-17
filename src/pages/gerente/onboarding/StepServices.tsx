import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { 
  ScissorIcon, 
  Delete02Icon, 
  Add01Icon, 
  CirclePlusIcon,
  ArrowRight01Icon, 
  ArrowLeft01Icon,
  Time01Icon
} from '@hugeicons/core-free-icons';
import type { OnboardingService } from './types';

interface StepServicesProps {
  services: OnboardingService[];
  baseCutPrice: number;
  onAddService: (service: Omit<OnboardingService, 'id'>) => void;
  onRemoveService: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const TEMPLATE_SERVICES = [
  { name: 'Corte Tradicional', priceRatio: 1.0, durationMinutes: 30, category: 'Cabelo' },
  { name: 'Barba', priceRatio: 0.75, durationMinutes: 30, category: 'Barba' },
  { name: 'Corte e Barba', priceRatio: 1.6, durationMinutes: 45, category: 'Combo' },
  { name: 'Pezinho e Acabamento', priceRatio: 0.4, durationMinutes: 15, category: 'Cabelo' },
];

const DURATION_OPTIONS = [
  15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300
];

export const StepServices: React.FC<StepServicesProps> = ({
  services,
  baseCutPrice,
  onAddService,
  onRemoveService,
  onNext,
  onBack,
}) => {
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customDuration, setCustomDuration] = useState('30');
  const [customCategory, setCustomCategory] = useState('Cabelo');
  const [showCustomForm, setShowCustomForm] = useState(false);

  const effectiveBasePrice = baseCutPrice > 0 ? baseCutPrice : 35;

  const handleAddTemplate = (tpl: typeof TEMPLATE_SERVICES[0]) => {
    const calculatedPrice = Math.round(effectiveBasePrice * tpl.priceRatio);
    onAddService({
      name: tpl.name,
      price: calculatedPrice,
      durationMinutes: tpl.durationMinutes,
      category: tpl.category,
    });
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customPrice) return;

    const numericPrice = parseFloat(customPrice.replace(',', '.'));
    if (isNaN(numericPrice) || numericPrice <= 0) return;

    onAddService({
      name: customName.trim(),
      price: numericPrice,
      durationMinutes: parseInt(customDuration, 10),
      category: customCategory,
    });

    setCustomName('');
    setCustomPrice('');
    setShowCustomForm(false);
  };

  const isTemplateAdded = (tplName: string) => {
    return services.some((s) => s.name.toLowerCase() === tplName.toLowerCase());
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div data-testid="step-services">
      <div>
        <span className="inline-block text-xs font-bold uppercase tracking-[0.5px] text-brand-primary bg-brand-lightest py-1 px-2.5 rounded-sm mb-2">Etapa 3 de 4 • Cardápio de Serviços</span>
        <h2 className="text-[1.45rem] font-bold text-text-primary m-0 mb-2 leading-[1.3]">Monte o seu cardápio de serviços</h2>
        <p className="text-[0.92rem] text-text-secondary m-0 mb-7 leading-[1.5]">
          O <strong>Corte Tradicional</strong> já está na sua lista. Adicione outros serviços comuns em 1 clique ou cadastre novos itens.
        </p>
      </div>

      {/* Sugestões Rápidas em 1 Clique */}
      <div>
        <label className="block text-[0.88rem] font-bold text-text-primary mb-3">
          Sugestões rápidas para adicionar:
        </label>
        <div className="grid [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))] gap-3 mb-6">
          {TEMPLATE_SERVICES.map((tpl) => {
            const added = isTemplateAdded(tpl.name);
            const calculatedPrice = Math.round(effectiveBasePrice * tpl.priceRatio);

            return (
              <button
                key={tpl.name}
                type="button"
                className={`flex items-center justify-between rounded-md py-3 px-[0.9rem] transition-all duration-200 ease-in text-left border-[1.5px] ${
                  added
                    ? 'bg-success-bg border-success cursor-default'
                    : 'bg-white border-border cursor-pointer enabled:hover:border-brand-primary enabled:hover:bg-[#FFFBF8] enabled:hover:-translate-y-0.5 enabled:hover:shadow-sm'
                }`}
                onClick={() => !added && handleAddTemplate(tpl)}
                disabled={added}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">
                    <HugeiconsIcon icon={ScissorIcon} size={18} />
                  </span>
                  <div>
                    <span className="block text-[0.88rem] font-bold text-text-primary">{tpl.name}</span>
                    <span className="block text-[0.78rem] text-text-secondary">
                      {formatCurrency(calculatedPrice)} • {tpl.durationMinutes} min
                    </span>
                  </div>
                </div>
                <span className={`text-xs font-bold ${added ? 'text-success' : 'text-brand-primary'}`}>
                  {added ? 'Adicionado' : '+ Adicionar'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Serviços Cadastrados */}
      <div className="bg-[#FAFAFA] border border-border rounded-lg p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-text-primary m-0">
            Serviços no Cardápio ({services.length})
          </h3>
          {!showCustomForm && (
            <button
              type="button"
              className="bg-white text-brand-primary border-[1.5px] border-brand-soft font-bold rounded-md cursor-pointer transition-all duration-200 ease-in inline-flex items-center justify-center gap-[0.45rem] leading-none hover:bg-brand-lightest h-9 px-[0.85rem] text-[0.82rem] [&_svg]:inline-flex [&_svg]:items-center [&_svg]:justify-center [&_svg]:shrink-0"
              onClick={() => setShowCustomForm(true)}
            >
              <HugeiconsIcon icon={CirclePlusIcon} size={16} />
              <span>Novo Serviço Personalizado</span>
            </button>
          )}
        </div>

        {services.length === 0 ? (
          <div className="text-center py-8 px-4 text-text-secondary text-[0.9rem]">
            <HugeiconsIcon icon={ScissorIcon} size={28} />
            <p>Seu cardápio ainda está vazio. Clique em uma das sugestões acima para começar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="text-[0.78rem] font-bold uppercase text-text-secondary py-[0.6rem] px-[0.85rem] border-b-[1.5px] border-border">Serviço</th>
                  <th className="text-[0.78rem] font-bold uppercase text-text-secondary py-[0.6rem] px-[0.85rem] border-b-[1.5px] border-border">Categoria</th>
                  <th className="text-[0.78rem] font-bold uppercase text-text-secondary py-[0.6rem] px-[0.85rem] border-b-[1.5px] border-border">Duração</th>
                  <th className="text-[0.78rem] font-bold uppercase text-text-secondary py-[0.6rem] px-[0.85rem] border-b-[1.5px] border-border">Preço</th>
                  <th className="text-[0.78rem] font-bold uppercase text-text-secondary py-[0.6rem] px-[0.85rem] border-b-[1.5px] border-border w-[60px] text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-[0.85rem] text-[0.88rem] border-b border-[#EFEAE6] bg-white">
                      <strong className="text-text-primary">{s.name}</strong>
                    </td>
                    <td className="py-3 px-[0.85rem] text-[0.88rem] border-b border-[#EFEAE6] bg-white">
                      <span className="bg-[#F4ECE6] py-[0.2rem] px-2 rounded-sm text-xs font-semibold">
                        {s.category === 'cabelo' ? 'Cabelo' : s.category === 'barba' ? 'Barba' : s.category === 'combo' ? 'Combo' : 'Outro'}
                      </span>
                    </td>
                    <td className="py-3 px-[0.85rem] text-[0.88rem] border-b border-[#EFEAE6] bg-white">
                      <span className="bg-[#EBF5FF] text-[#1E429F] py-[0.2rem] px-[0.55rem] rounded-sm text-xs font-semibold">
                        <HugeiconsIcon icon={Time01Icon} size={12} />
                        <span>{s.durationMinutes} min</span>
                      </span>
                    </td>
                    <td className="py-3 px-[0.85rem] text-[0.88rem] border-b border-[#EFEAE6] bg-white">
                      <strong className="text-brand-primary font-bold">{formatCurrency(s.price)}</strong>
                    </td>
                    <td className="py-3 px-[0.85rem] text-[0.88rem] border-b border-[#EFEAE6] bg-white text-center">
                      <button
                        type="button"
                        className="bg-none border-none cursor-pointer text-[1.1rem] opacity-60 transition-opacity duration-200 ease-in hover:opacity-100"
                        onClick={() => onRemoveService(s.id)}
                        title="Remover serviço"
                        aria-label={`Remover ${s.name}`}
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formulário de Serviço Customizado */}
      {showCustomForm && (
        <form className="bg-white border-[1.5px] border-border rounded-md p-5 mb-6" onSubmit={handleAddCustom}>
          <div className="flex justify-between items-center mb-4">
            <h4 className="m-0 text-[0.95rem] font-bold">Cadastrar Novo Serviço</h4>
            <button
              type="button"
              className="bg-none border-none text-text-secondary text-[0.8rem] cursor-pointer underline"
              onClick={() => setShowCustomForm(false)}
            >
              Fechar
            </button>
          </div>

          <div className="flex flex-wrap gap-[0.85rem]">
            <div className="flex flex-col gap-[0.4rem] w-[calc(50%-0.6rem)] max-[680px]:w-full">
              <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="custom-service-name">Nome do Serviço</label>
              <input
                id="custom-service-name"
                type="text"
                className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
                placeholder="Ex: Hidratação, Luzes, Platinado"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-[0.4rem] w-[calc(50%-0.6rem)] max-[680px]:w-full">
              <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="custom-service-price">Preço (R$)</label>
              <input
                id="custom-service-price"
                type="text"
                className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
                placeholder="Ex: 50,00"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-[0.4rem] w-[calc(50%-0.6rem)] max-[680px]:w-full">
              <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="custom-service-duration">Duração do Atendimento</label>
              <select
                id="custom-service-duration"
                className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
              >
                {DURATION_OPTIONS.map((mins) => (
                  <option key={mins} value={mins}>
                    {mins} minutos {mins >= 60 ? `(${mins / 60}h${mins % 60 ? `${mins % 60}m` : ''})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-[0.4rem] w-[calc(50%-0.6rem)] max-[680px]:w-full">
              <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="custom-service-category">Categoria</label>
              <select
                id="custom-service-category"
                className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              >
                <option value="cabelo">Cabelo</option>
                <option value="barba">Barba</option>
                <option value="combo">Combo</option>
                <option value="quimica">Química ou Coloração</option>
                <option value="estetica">Estética ou Sobrancelha</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-[0.65rem] mt-4">
            <button
              type="button"
              className="bg-white text-text-primary border-[1.5px] border-border font-semibold font-[inherit] rounded-md cursor-pointer transition-all duration-200 ease-in enabled:hover:bg-[#FDF9F6] enabled:hover:border-[#D3C4B8] h-9 px-[0.85rem] text-[0.82rem]"
              onClick={() => setShowCustomForm(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-brand-primary text-white border-none font-bold font-[inherit] rounded-md cursor-pointer transition-all duration-200 ease-in inline-flex items-center justify-center gap-2 enabled:hover:bg-brand-hover enabled:hover:-translate-y-px enabled:hover:shadow-[0_3px_8px_rgba(217,108,0,0.25)] disabled:opacity-50 disabled:cursor-not-allowed h-9 px-[0.85rem] text-[0.82rem]"
            >
              <HugeiconsIcon icon={Add01Icon} size={14} />
              <span>Salvar Serviço</span>
            </button>
          </div>
        </form>
      )}

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-border max-[680px]:flex-col-reverse max-[680px]:gap-3 max-[680px]:[&>button]:w-full">
        <button
          type="button"
          className="bg-white text-text-primary border-[1.5px] border-border font-semibold font-[inherit] rounded-md cursor-pointer transition-all duration-200 ease-in inline-flex items-center justify-center gap-2 enabled:hover:bg-[#FDF9F6] enabled:hover:border-[#D3C4B8] h-12 px-[1.65rem] text-[0.98rem]"
          onClick={onBack}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          <span>Voltar</span>
        </button>
        <button
          type="button"
          className="bg-brand-primary text-white border-none font-bold font-[inherit] rounded-md cursor-pointer transition-all duration-200 ease-in inline-flex items-center justify-center gap-2 enabled:hover:bg-brand-hover enabled:hover:-translate-y-px enabled:hover:shadow-[0_3px_8px_rgba(217,108,0,0.25)] disabled:opacity-50 disabled:cursor-not-allowed h-12 px-[1.65rem] text-[0.98rem]"
          onClick={onNext}
          disabled={services.length === 0}
        >
          <span>Continuar para Equipe</span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
        </button>
      </div>
    </div>
  );
};
