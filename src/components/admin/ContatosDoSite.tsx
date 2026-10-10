import React, { useState } from 'react';
import { ROTULO_DO_STATUS, quandoChegou } from '../../modules/contatos-do-site/apresentacao';
import type { StatusDoContato } from '../../modules/contatos-do-site/types';
import { useContatosDoSite } from '../../modules/contatos-do-site/useContatosDoSite';
import { Button } from '../ui';

const FILTROS: { rotulo: string; status: StatusDoContato | null; vazio: string }[] = [
  { rotulo: 'Novos', status: 'novo', vazio: 'Nenhum contato novo.' },
  { rotulo: 'Lidos', status: 'lido', vazio: 'Nenhum contato lido.' },
  { rotulo: 'Respondidos', status: 'respondido', vazio: 'Nenhum contato respondido.' },
  { rotulo: 'Todos', status: null, vazio: 'Nenhum contato recebido pelo site.' },
];

const CLASSE_DO_STATUS: Record<StatusDoContato, string> = {
  novo: 'bg-warning-bg text-warning',
  lido: 'bg-info-bg text-info',
  respondido: 'bg-success-bg text-success',
};

/**
 * As mensagens do formulário de contato do site (spec 056), da mais nova para a mais antiga, filtradas pelo andamento (Novos por
 * padrão). Cada linha abre com o e-mail e a mensagem inteira. A resposta é feita fora do Navalhado.
 */
export const ContatosDoSite: React.FC = () => {
  const lista = useContatosDoSite();

  return (
    <>
      <div role="group" aria-label="Filtrar por andamento" className="flex flex-wrap gap-2 px-5 pt-5 max-md:px-4">
        {FILTROS.map(({ rotulo, status }) => {
          const atual = lista.filtro === status;
          return (
            <button
              key={rotulo}
              type="button"
              aria-pressed={atual}
              onClick={() => lista.setFiltro(status)}
              className={`text-xs md:text-sm font-medium px-2.5 md:px-3 py-[0.35rem] rounded-full border cursor-pointer transition-colors ${
                atual
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-transparent text-text-secondary border-border hover:text-brand-primary hover:border-brand-primary'
              }`}
            >
              {rotulo}
            </button>
          );
        })}
      </div>
      <Lista {...lista} />
    </>
  );
};

type Props = ReturnType<typeof useContatosDoSite>;

const Lista: React.FC<Props> = ({ filtro, contatos, haMais, status, recarregar, carregarMais, carregandoMais, erroAoCarregarMais }) => {
  const [aberto, setAberto] = useState<number | null>(null);

  if (status === 'loading') {
    return (
      <div className="p-16 flex flex-col items-center gap-4 text-text-secondary">
        <div className="spinner border-brand-primary border-t-transparent" />
        <span>Carregando contatos...</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-3 p-5">
        <p role="alert" className="m-0 text-sm text-error">
          Não foi possível carregar os contatos.
        </p>
        <Button size="sm" variant="outline" onClick={recarregar}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (contatos.length === 0) {
    const vazio = FILTROS.find((f) => f.status === filtro)?.vazio;
    return <p className="m-0 p-5 text-sm text-text-secondary max-md:px-4">{vazio}</p>;
  }

  return (
    <>
      <ul aria-label="Contatos do site" className="m-0 mt-4 p-0 list-none border-t border-border">
        {contatos.map((contato) => {
          const estaAberto = aberto === contato.id;
          return (
            <li key={contato.id} className="border-t border-border first:border-t-0">
              <button
                type="button"
                aria-expanded={estaAberto}
                onClick={() => setAberto(estaAberto ? null : contato.id)}
                className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-left bg-transparent border-0 cursor-pointer hover:bg-[rgba(255,255,255,0.5)] max-md:px-4"
              >
                <span className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold text-text-primary truncate">{`${contato.nome} ${contato.sobrenome}`}</span>
                  {contato.barbearia && <span className="text-xs text-text-secondary truncate">{contato.barbearia}</span>}
                </span>
                <span className="text-sm text-text-primary min-w-0 max-md:basis-full max-md:order-last">{contato.assunto}</span>
                <span className="text-xs text-text-secondary whitespace-nowrap">{quandoChegou(contato.recebidoEm)}</span>
                <span className={`text-xs font-semibold px-2 py-[2px] rounded-full whitespace-nowrap ${CLASSE_DO_STATUS[contato.status]}`}>
                  {ROTULO_DO_STATUS[contato.status]}
                </span>
              </button>

              {estaAberto && (
                <div className="flex flex-col gap-3 px-5 pb-5 max-md:px-4">
                  <p className="m-0 text-sm">
                    <span className="text-text-secondary">E-mail: </span>
                    <span className="break-all">{contato.email}</span>
                  </p>
                  <p className="m-0 text-sm text-text-primary whitespace-pre-wrap break-words">{contato.mensagem}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {(haMais || erroAoCarregarMais) && (
        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border p-4">
          {erroAoCarregarMais && (
            <p role="alert" className="m-0 text-sm text-error">
              Não foi possível carregar mais contatos.
            </p>
          )}
          <Button size="sm" variant="outline" onClick={carregarMais} disabled={carregandoMais}>
            Carregar mais
          </Button>
        </div>
      )}
    </>
  );
};
