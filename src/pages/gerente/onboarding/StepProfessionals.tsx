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
    <div className="onboarding-step" data-testid="step-professionals">
      <div className="onboarding-step-header">
        <span className="step-pill">Etapa 4 de 4 • Equipe e Barbeiros</span>
        <h2>Quem vai atender na sua barbearia?</h2>
        <p className="onboarding-step-subtitle">
          Cadastre os barbeiros que terão horários disponíveis na agenda online do salão.
        </p>
      </div>

      {/* Medidor de Cota do Plano */}
      <div className={`quota-status-card ${isQuotaFull ? 'quota-status-card--full' : ''}`}>
        <div className="quota-status-info">
          <span className="quota-icon">
            <HugeiconsIcon icon={UserGroupIcon} size={22} />
          </span>
          <div>
            <strong className="quota-count-title">
              {professionals.length} de {maxProfessionals > 100 ? 'Ilimitados' : maxProfessionals} barbeiros cadastrados
            </strong>
            <p className="quota-plan-text">Plano {planName || 'Bronze'}</p>
          </div>
        </div>
        {isQuotaFull ? (
          <span className="quota-badge-full">Limite Atingido</span>
        ) : (
          <span className="quota-badge-open">Vagas Abertas</span>
        )}
      </div>

      {/* Sugestão de Adicionar o Gestor */}
      {!hasManager && !isQuotaFull && (
        <div className="manager-prompt-card">
          <div className="manager-prompt-card__text">
            <span className="manager-icon">
              <HugeiconsIcon icon={ScissorIcon} size={20} />
            </span>
            <div>
              <strong>Você ({managerName || 'Gestor'}) também atende clientes?</strong>
              <p>Clique ao lado para se cadastrar na agenda com 1 clique usando seus dados.</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-outline-primary btn-sm"
            onClick={handleAddManagerAsBarber}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} />
            <span>Me incluir como Barbeiro</span>
          </button>
        </div>
      )}

      {/* Formulário de Adição de Barbeiro */}
      {!isQuotaFull ? (
        <div className="add-barber-box">
          <label className="section-small-title">Adicionar Barbeiro:</label>
          <form className="add-barber-form" onSubmit={handleAddBarber}>
            <div className="form-group flex-2">
              <label className="form-label" htmlFor="barber-name">Nome do Barbeiro</label>
              <input
                id="barber-name"
                type="text"
                className="form-input"
                placeholder="Ex: Carlos Navalha"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group flex-2">
              <label className="form-label" htmlFor="barber-phone">Celular ou WhatsApp</label>
              <input
                id="barber-phone"
                type="text"
                className="form-input"
                placeholder="(99) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                maxLength={15}
              />
            </div>

            <div className="form-group flex-1">
              <label className="form-label" htmlFor="barber-commission">Comissão (%)</label>
              <div className="input-with-suffix">
                <input
                  id="barber-commission"
                  type="number"
                  className="form-input"
                  placeholder="50"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  min="0"
                  max="100"
                />
                <span className="suffix">%</span>
              </div>
            </div>

            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button type="submit" className="btn-primary" style={{ height: '44px' }}>
                <HugeiconsIcon icon={Add01Icon} size={16} />
                <span>Adicionar</span>
              </button>
            </div>
          </form>
          {formError && <p className="form-error">{formError}</p>}
        </div>
      ) : (
        <div className="plan-upgrade-alert">
          <p>
            Você atingiu o limite de {maxProfessionals} profissionais do seu plano <strong>{planName}</strong>.
            Para adicionar novos barbeiros, solicite o upgrade nas configurações após a finalização.
          </p>
        </div>
      )}

      {/* Tabela de Profissionais */}
      <div className="services-list-container" style={{ marginTop: '1.5rem' }}>
        <h3 className="services-list-title">
          Barbeiros Ativos na Agenda ({professionals.length})
        </h3>

        {professionals.length === 0 ? (
          <div className="empty-services-alert">
            <HugeiconsIcon icon={UserIcon} size={28} />
            <p>Nenhum profissional cadastrado. Adicione pelo menos um barbeiro acima.</p>
          </div>
        ) : (
          <div className="services-table-wrapper">
            <table className="services-table">
              <thead>
                <tr>
                  <th>Profissional</th>
                  <th>Celular ou WhatsApp</th>
                  <th>Comissão</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {professionals.map((prof) => (
                  <tr key={prof.id}>
                    <td>
                      <strong className="service-row-name">{prof.name}</strong>
                      {prof.isManager && <span className="badge-manager">Gestor Titular</span>}
                    </td>
                    <td>{prof.phone || '—'}</td>
                    <td><span className="service-duration-badge">{prof.commissionPercentage}%</span></td>
                    <td style={{ textAlign: 'center' }}>
                      {professionals.length > 1 ? (
                        <button
                          type="button"
                          className="btn-icon-delete"
                          onClick={() => onRemoveProfessional(prof.id)}
                          title="Remover profissional"
                          aria-label={`Remover ${prof.name}`}
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={16} />
                        </button>
                      ) : (
                        <span className="tag-required" title="A barbearia deve ter ao menos 1 profissional ativo">
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

      <div className="onboarding-actions">
        <button type="button" className="btn-secondary btn-lg" onClick={onBack} disabled={submitting}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          <span>Voltar para Serviços</span>
        </button>
        <button
          type="button"
          className="btn-primary btn-lg btn-finish"
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
