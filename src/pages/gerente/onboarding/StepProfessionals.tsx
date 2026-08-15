import React, { useState } from 'react';
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
      setFormError(`Limite atingido! O plano ${planName} permite no máximo ${maxProfessionals} profissionais.`);
      return;
    }

    if (!name.trim()) {
      setFormError('Informe o nome do profissional.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFormError('Informe um celular/WhatsApp válido (DDD + número).');
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
        <h2>Cadastre sua Equipe de Barbeiros</h2>
        <p className="onboarding-step-subtitle">
          Configure quem irá atender na barbearia para que a agenda e o agendamento do WhatsApp fiquem prontos.
        </p>
      </div>

      {/* Medidor de Cota do Plano */}
      <div className={`quota-status-card ${isQuotaFull ? 'quota-status-card--full' : ''}`}>
        <div className="quota-status-info">
          <span className="quota-icon">💈</span>
          <div>
            <strong>
              {professionals.length} de {maxProfessionals} profissionais cadastrados
            </strong>
            <p className="quota-plan-text">Plano {planName || 'Bronze'}</p>
          </div>
        </div>
        {isQuotaFull && (
          <span className="quota-badge-full">Capacidade Máxima do Plano</span>
        )}
      </div>

      {/* Sugestão de Adicionar o Gestor se ainda não estiver na lista */}
      {!hasManager && !isQuotaFull && (
        <div className="manager-prompt-card">
          <div>
            <strong>Você ({managerName || 'Gestor'}) também atende clientes?</strong>
            <p>Clique abaixo para se incluir como barbeiro ativo na agenda com 1 clique.</p>
          </div>
          <button
            type="button"
            className="btn-add-manager"
            onClick={handleAddManagerAsBarber}
          >
            + Me incluir como Barbeiro
          </button>
        </div>
      )}

      {/* Formulário de Adição de Barbeiro */}
      {!isQuotaFull ? (
        <div className="custom-service-box">
          <label className="section-small-title">Adicionar Novo Barbeiro / Colaborador:</label>
          <form className="custom-service-form" onSubmit={handleAddBarber}>
            <div className="form-group flex-2">
              <input
                type="text"
                className="form-input"
                placeholder="Nome do barbeiro"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group flex-2">
              <input
                type="text"
                className="form-input"
                placeholder="WhatsApp (99) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                maxLength={15}
              />
            </div>

            <div className="form-group flex-1">
              <div className="input-with-suffix">
                <input
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

            <button type="submit" className="btn-add-service">
              + Adicionar
            </button>
          </form>
          {formError && <p className="form-error-msg">{formError}</p>}
        </div>
      ) : (
        <div className="plan-upgrade-alert">
          <p>
            Você atingiu o limite de {maxProfessionals} profissionais do seu plano <strong>{planName}</strong>.
            Para adicionar mais membros à equipe, realize o upgrade no menu de Ajustes após o onboarding.
          </p>
        </div>
      )}

      {/* Tabela de Profissionais */}
      <div className="added-services-list">
        <label className="section-small-title">
          Profissionais na Agenda ({professionals.length}):
        </label>

        {professionals.length === 0 ? (
          <div className="services-empty-state">
            <p>Nenhum profissional cadastrado. Adicione pelo menos um barbeiro acima.</p>
          </div>
        ) : (
          <table className="onboarding-table">
            <thead>
              <tr>
                <th>Profissional</th>
                <th>Celular / WhatsApp</th>
                <th>Comissão</th>
                <th style={{ width: '80px' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {professionals.map((prof) => (
                <tr key={prof.id}>
                  <td>
                    <strong>{prof.name}</strong>
                    {prof.isManager && <span className="badge-manager">Gestor Titular</span>}
                  </td>
                  <td>{prof.phone || '—'}</td>
                  <td>{prof.commissionPercentage}%</td>
                  <td>
                    {professionals.length > 1 ? (
                      <button
                        type="button"
                        className="btn-remove-row"
                        onClick={() => onRemoveProfessional(prof.id)}
                        title="Remover profissional"
                      >
                        Remover
                      </button>
                    ) : (
                      <span className="cant-remove-tooltip" title="A barbearia deve ter ao menos 1 profissional ativo">
                        Obrigatório
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="onboarding-actions">
        <button type="button" className="btn-onboarding-secondary" onClick={onBack} disabled={submitting}>
          ← Voltar para Serviços
        </button>
        <button
          type="button"
          className="btn-onboarding-finish"
          onClick={onFinish}
          disabled={professionals.length === 0 || submitting}
        >
          {submitting ? 'Salvando Configurações...' : '✓ Concluir e Entrar no Painel'}
        </button>
      </div>
    </div>
  );
};
