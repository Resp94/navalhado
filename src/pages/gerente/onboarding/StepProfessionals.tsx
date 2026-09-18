import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { 
  UserGroupIcon, 
  UserIcon, 
  Add01Icon, 
  Delete02Icon, 
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  ScissorIcon
} from '@hugeicons/core-free-icons';
import type { ProfessionalItem } from './types';

interface StepProfessionalsProps {
  professionals: ProfessionalItem[];
  maxProfessionals: number;
  planName: string;
  managerName: string;
  managerPhone: string;
  submitting: boolean;
  onAddProfessional: (prof: Omit<ProfessionalItem, 'id'>) => void;
  onRemoveProfessional: (id: string) => void;
  onFinish: () => void;
  onBack: () => void;
}

export const StepProfessionals: React.FC<StepProfessionalsProps> = ({
  professionals,
  maxProfessionals,
  planName,
  managerName,
  managerPhone,
  submitting,
  onAddProfessional,
  onRemoveProfessional,
  onFinish,
  onBack,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [commission, setCommission] = useState('50');
  const [formError, setFormError] = useState<string | null>(null);

  const formatPhone = (val: string) => {
    const numbers = val.replace(/\D/g, '').slice(0, 11);
    if (numbers.length > 6) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
    if (numbers.length > 2) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    }
    return numbers;
  };

  const isQuotaFull = professionals.length >= maxProfessionals;

  const handleAddBarber = (e: React.FormEvent) => {
    e.preventDefault();
    if (isQuotaFull) {
      setFormError(`Limite atingido. O plano ${planName} permite no máximo ${maxProfessionals} profissionais.`);
      return;
    }

    if (!name.trim()) {
      setFormError('Informe o nome do profissional.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFormError('Informe um celular ou WhatsApp válido (DDD + número).');
      return;
    }

    const commNum = parseFloat(commission);
    if (isNaN(commNum) || commNum < 0 || commNum > 100) {
      setFormError('Comissão deve ser um número entre 0% e 100%.');
      return;
    }

    setFormError(null);
    onAddProfessional({
      name: name.trim(),
      phone: formatPhone(phone),
      commissionPercentage: commNum,
    });

    setName('');
    setPhone('');
    setCommission('50');
  };

  const handleAddManagerAsBarber = () => {
    if (isQuotaFull) return;
    if (professionals.some(p => p.isManager || p.name.toLowerCase() === managerName.toLowerCase())) {
      return;
    }

    onAddProfessional({
      name: managerName || 'Gestor Principal',
      phone: managerPhone || '',
      commissionPercentage: 50,
      isManager: true,
    });
  };

  const hasManager = professionals.some(p => p.isManager || p.name.toLowerCase() === (managerName || '').toLowerCase());

  return (
    <div data-testid="step-professionals">
      <div>
        <span className="inline-block text-xs font-bold uppercase tracking-[0.5px] text-brand-primary bg-brand-lightest py-1 px-2.5 rounded-sm mb-2">Etapa 4 de 4 • Equipe e Barbeiros</span>
        <h2 className="text-[1.45rem] font-bold text-text-primary m-0 mb-2 leading-[1.3]">Quem vai atender na sua barbearia?</h2>
        <p className="text-[0.92rem] text-text-secondary m-0 mb-7 leading-[1.5]">
          Cadastre os barbeiros que terão horários disponíveis na agenda online do salão.
        </p>
      </div>

      {/* Medidor de Cota do Plano */}
      <div className="flex justify-between items-center bg-[#FFF9F5] border-[1.5px] border-brand-soft rounded-md py-4 px-5 mb-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            <HugeiconsIcon icon={UserGroupIcon} size={22} />
          </span>
          <div>
            <strong className="text-[0.95rem] text-text-primary">
              {professionals.length} de {maxProfessionals > 100 ? 'Ilimitados' : maxProfessionals} barbeiros cadastrados
            </strong>
            <p className="m-0 text-[0.78rem] text-text-secondary">Plano {planName || 'Bronze'}</p>
          </div>
        </div>
        {isQuotaFull ? (
          <span className="bg-warning-bg text-warning text-xs font-bold py-1 px-[0.65rem] rounded-full">Limite Atingido</span>
        ) : (
          <span className="bg-success-bg text-success text-xs font-bold py-1 px-[0.65rem] rounded-full">Vagas Abertas</span>
        )}
      </div>

      {/* Sugestão de Adicionar o Gestor */}
      {!hasManager && !isQuotaFull && (
        <div className="flex justify-between items-center bg-[#F4FBF7] border border-dashed border-success rounded-md py-4 px-5 mb-5">
          <div className="flex items-center gap-3">
            <span className="text-[1.35rem]">
              <HugeiconsIcon icon={ScissorIcon} size={20} />
            </span>
            <div>
              <strong>Você ({managerName || 'Gestor'}) também atende clientes?</strong>
              <p className="m-0 text-[0.8rem] text-text-secondary">Clique ao lado para se cadastrar na agenda com 1 clique usando seus dados.</p>
            </div>
          </div>
          <button
            type="button"
            className="bg-white text-brand-primary border-[1.5px] border-brand-soft font-bold rounded-md cursor-pointer transition-all duration-200 ease-in inline-flex items-center justify-center gap-[0.45rem] leading-none hover:bg-brand-lightest h-9 px-[0.85rem] text-[0.82rem]"
            onClick={handleAddManagerAsBarber}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} />
            <span>Me incluir como Barbeiro</span>
          </button>
        </div>
      )}

      {/* Formulário de Adição de Barbeiro */}
      {!isQuotaFull ? (
        <div className="bg-white border-[1.5px] border-border rounded-md p-5 mb-5">
          <label className="block text-[0.88rem] font-bold text-text-primary mb-3">Adicionar Barbeiro:</label>
          <form className="flex gap-3 max-[680px]:flex-col" onSubmit={handleAddBarber}>
            <div className="flex flex-col gap-[0.4rem] flex-[2]">
              <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="barber-name">Nome do Barbeiro</label>
              <input
                id="barber-name"
                type="text"
                className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
                placeholder="Ex: Carlos Navalha"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-[0.4rem] flex-[2]">
              <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="barber-phone">Celular ou WhatsApp</label>
              <input
                id="barber-phone"
                type="text"
                className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
                placeholder="(99) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                maxLength={15}
              />
            </div>

            <div className="flex flex-col gap-[0.4rem] flex-1">
              <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="barber-commission">Comissão (%)</label>
              <div className="relative flex items-center">
                <input
                  id="barber-commission"
                  type="number"
                  className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
                  placeholder="50"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  min="0"
                  max="100"
                />
                <span className="absolute right-3 font-semibold text-text-secondary">%</span>
              </div>
            </div>

            <div className="flex flex-col gap-[0.4rem] self-end">
              <button
                type="submit"
                className="bg-brand-primary text-white border-none font-bold font-[inherit] rounded-md cursor-pointer transition-all duration-200 ease-in inline-flex items-center justify-center gap-2 enabled:hover:bg-brand-hover enabled:hover:-translate-y-px enabled:hover:shadow-[0_3px_8px_rgba(217,108,0,0.25)] disabled:opacity-50 disabled:cursor-not-allowed px-5 h-11"
              >
                <HugeiconsIcon icon={Add01Icon} size={16} />
                <span>Adicionar</span>
              </button>
            </div>
          </form>
          {formError && <p className="text-[0.78rem] text-error mt-[0.2rem]">{formError}</p>}
        </div>
      ) : (
        <div>
          <p>
            Você atingiu o limite de {maxProfessionals} profissionais do seu plano <strong>{planName}</strong>.
            Para adicionar novos barbeiros, solicite o upgrade nas configurações após a finalização.
          </p>
        </div>
      )}

      {/* Tabela de Profissionais */}
      <div className="bg-[#FAFAFA] border border-border rounded-lg p-5 mb-6 mt-6">
        <h3 className="text-base font-bold text-text-primary m-0">
          Barbeiros Ativos na Agenda ({professionals.length})
        </h3>

        {professionals.length === 0 ? (
          <div className="text-center py-8 px-4 text-text-secondary text-[0.9rem]">
            <HugeiconsIcon icon={UserIcon} size={28} />
            <p>Nenhum profissional cadastrado. Adicione pelo menos um barbeiro acima.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="text-[0.78rem] font-bold uppercase text-text-secondary py-[0.6rem] px-[0.85rem] border-b-[1.5px] border-border">Profissional</th>
                  <th className="text-[0.78rem] font-bold uppercase text-text-secondary py-[0.6rem] px-[0.85rem] border-b-[1.5px] border-border">Celular ou WhatsApp</th>
                  <th className="text-[0.78rem] font-bold uppercase text-text-secondary py-[0.6rem] px-[0.85rem] border-b-[1.5px] border-border">Comissão</th>
                  <th className="text-[0.78rem] font-bold uppercase text-text-secondary py-[0.6rem] px-[0.85rem] border-b-[1.5px] border-border w-[80px] text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {professionals.map((prof) => (
                  <tr key={prof.id}>
                    <td className="py-3 px-[0.85rem] text-[0.88rem] border-b border-[#EFEAE6] bg-white">
                      <strong className="text-text-primary">{prof.name}</strong>
                      {prof.isManager && (
                        <span className="ml-2 text-xs bg-brand-lightest text-brand-primary border border-brand-soft py-[0.1rem] px-[0.4rem] rounded-sm">Gestor Titular</span>
                      )}
                    </td>
                    <td className="py-3 px-[0.85rem] text-[0.88rem] border-b border-[#EFEAE6] bg-white">{prof.phone || '—'}</td>
                    <td className="py-3 px-[0.85rem] text-[0.88rem] border-b border-[#EFEAE6] bg-white">
                      <span className="bg-[#EBF5FF] text-[#1E429F] py-[0.2rem] px-[0.55rem] rounded-sm text-xs font-semibold">{prof.commissionPercentage}%</span>
                    </td>
                    <td className="py-3 px-[0.85rem] text-[0.88rem] border-b border-[#EFEAE6] bg-white text-center">
                      {professionals.length > 1 ? (
                        <button
                          type="button"
                          className="bg-none border-none cursor-pointer text-[1.1rem] opacity-60 transition-opacity duration-200 ease-in hover:opacity-100"
                          onClick={() => onRemoveProfessional(prof.id)}
                          title="Remover profissional"
                          aria-label={`Remover ${prof.name}`}
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={16} />
                        </button>
                      ) : (
                        <span
                          className="text-[0.72rem] text-text-secondary bg-[#EAE0D8] py-[0.15rem] px-[0.45rem] rounded-sm"
                          title="A barbearia deve ter ao menos 1 profissional ativo"
                        >
                          Obrigatório
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-border max-[680px]:flex-col-reverse max-[680px]:gap-3 max-[680px]:[&>button]:w-full">
        <button
          type="button"
          className="bg-white text-text-primary border-[1.5px] border-border font-semibold font-[inherit] rounded-md cursor-pointer transition-all duration-200 ease-in inline-flex items-center justify-center gap-2 enabled:hover:bg-[#FDF9F6] enabled:hover:border-[#D3C4B8] h-12 px-[1.65rem] text-[0.98rem]"
          onClick={onBack}
          disabled={submitting}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          <span>Voltar para Serviços</span>
        </button>
        <button
          type="button"
          className="bg-success text-white border-none font-bold font-[inherit] rounded-md cursor-pointer transition-all duration-200 ease-in inline-flex items-center justify-center gap-2 enabled:hover:bg-[#097A54] enabled:hover:-translate-y-px enabled:hover:shadow-[0_3px_8px_rgba(217,108,0,0.25)] disabled:opacity-50 disabled:cursor-not-allowed h-12 px-[1.65rem] text-[0.98rem]"
          onClick={onFinish}
          disabled={professionals.length === 0 || submitting}
        >
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} />
          <span>{submitting ? 'Salvando Configurações...' : 'Concluir e Abrir meu Painel'}</span>
        </button>
      </div>
    </div>
  );
};
