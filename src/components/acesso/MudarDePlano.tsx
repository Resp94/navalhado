import React, { useState } from 'react';
import { formatCurrency } from '../../lib/currency';
import { pluralizar } from '../../lib/plural';
import { Button } from '../ui';
import { FormularioDeCartao } from '../cartao/FormularioDeCartao';
import { useTrocarDePlano } from '../../modules/assinatura/useTrocarDePlano';
import type { CotacaoDaTroca, DetalhesDaAssinatura, PagamentoDaTroca, PlanoTrocado } from '../../modules/assinatura/types';
import type { CartaoRepository } from '../../modules/cartao/CartaoRepository';
import { cartaoDaCobrancaRepository } from '../../modules/cartao/repositorio';
import type { Plano } from '../../modules/planos/types';
import { usePlanos } from '../../modules/planos/usePlanos';

interface MudarDePlanoProps {
  /** Em teste a troca é livre (qualquer outro plano); na assinatura ativa só se sobe. */
  assinatura: Pick<DetalhesDaAssinatura, 'situacao' | 'plano'>;
  /** Chamado depois de o plano trocar: a tela relê a assinatura e mostra o plano novo. */
  onTrocado?: () => void;
  /** Os campos seguros do cartão que paga a diferença. Por padrão, os da cobrança avulsa. */
  repositorio?: CartaoRepository;
}

const limiteDoPlano = (maximo: number) => pluralizar(maximo, '1 profissional', `Até ${maximo} profissionais`);

function textoDoAviso(plano: Plano, trocado: PlanoTrocado): string {
  const partes = [`Plano trocado para ${trocado.nomeDoPlano}.`];
  if (trocado.cobrado > 0) partes.push(`Cobramos ${formatCurrency(trocado.cobrado)} da diferença.`);
  partes.push(
    `O limite do plano agora é de ${pluralizar(plano.max_professionals, '1 profissional', `até ${plano.max_professionals} profissionais`)}.`,
  );
  partes.push(`O valor mensal passa a ser ${formatCurrency(trocado.valorMensalNovo)}.`);
  if (!trocado.proximaCobrancaAtualizada) {
    partes.push('Não conseguimos atualizar o valor da próxima cobrança no Mercado Pago agora. Fale com o suporte para conferir.');
  }
  return partes.join(' ');
}

/**
 * Mudar de plano pela tela Assinatura (spec 052, ticket 10). Em teste a troca é livre e sem cobrança. Na assinatura
 * ativa o Gerente só sobe: ao escolher o plano vê a diferença proporcional aos dias que faltam no período e o valor
 * mensal novo (calculados pela função de cobrança, que é quem cobra), e paga a diferença no cartão digitado nos campos
 * seguros do Mercado Pago. O plano só troca com o pagamento aprovado; recusado, continua o mesmo. Se a diferença for
 * pequena demais para o Mercado Pago cobrar, o plano troca sem cobrança.
 *
 * Não usa <form>: a tela Assinatura fica dentro do formulário de Configurações.
 */
export const MudarDePlano: React.FC<MudarDePlanoProps> = ({
  assinatura,
  onTrocado,
  repositorio = cartaoDaCobrancaRepository,
}) => {
  const { planos, status: statusDosPlanos } = usePlanos();
  const { cotar, cotacao, cotando, erroDaCotacao, trocar, trocando, erro, limpar } = useTrocarDePlano();
  const [aberto, setAberto] = useState(false);
  const [escolhido, setEscolhido] = useState<Plano | null>(null);
  const [resultado, setResultado] = useState<{ plano: Plano; trocado: PlanoTrocado } | null>(null);

  const opcoes = planos.filter((plano) =>
    assinatura.situacao === 'trialing' ? plano.id !== assinatura.plano.id : plano.price > assinatura.plano.preco,
  );

  const voltarParaALista = () => {
    limpar();
    setEscolhido(null);
  };

  const fechar = () => {
    voltarParaALista();
    setResultado(null);
    setAberto(false);
  };

  const escolher = (plano: Plano) => {
    setEscolhido(plano);
    void cotar(plano.id);
  };

  const confirmar = async (pagamento?: PagamentoDaTroca) => {
    if (!escolhido) return;
    const trocado = await trocar(escolhido.id, pagamento);
    if (!trocado) return;
    setResultado({ plano: escolhido, trocado });
    onTrocado?.();
  };

  if (resultado) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-md border border-border p-4">
        <p className="m-0 text-sm">{textoDoAviso(resultado.plano, resultado.trocado)}</p>
        <div>
          <Button variant="outline" size="sm" onClick={fechar}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  if (!aberto) {
    if (statusDosPlanos !== 'ready' || opcoes.length === 0) return null;
    return (
      <div>
        <Button variant="outline" onClick={() => setAberto(true)}>
          Mudar de plano
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4">
      <div role="group" aria-label="Planos disponíveis" className="flex flex-col gap-2">
        <span className="text-sm font-extrabold text-text-primary">Escolha o novo plano</span>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {opcoes.map((plano) => (
            <button
              key={plano.id}
              type="button"
              aria-pressed={escolhido?.id === plano.id}
              disabled={trocando}
              onClick={() => escolher(plano)}
              className={`flex cursor-pointer flex-col gap-1 rounded-lg border bg-bg-secondary p-3 text-left transition-colors duration-150 ${
                escolhido?.id === plano.id ? 'border-brand-primary bg-brand-lightest' : 'border-border hover:border-brand-soft'
              } disabled:cursor-not-allowed disabled:opacity-55`}
            >
              <span className="text-sm font-bold text-text-primary">{plano.name}</span>
              <span className="text-xs text-text-secondary">{limiteDoPlano(plano.max_professionals)}</span>
              <span className="text-sm font-semibold text-brand-primary">{formatCurrency(plano.price)} por mês</span>
            </button>
          ))}
        </div>
      </div>

      {escolhido && (
        <div className="flex flex-col gap-3" aria-live="polite">
          {cotando && <p className="m-0 text-sm text-text-secondary">Calculando a diferença…</p>}
          {erroDaCotacao && (
            <p role="alert" className="m-0 text-sm text-error">
              {erroDaCotacao}
            </p>
          )}
          {cotacao && (
            <ResumoDaTroca
              cotacao={cotacao}
              plano={escolhido}
              trocando={trocando}
              erro={erro}
              repositorio={repositorio}
              onCancelar={voltarParaALista}
              onConfirmar={confirmar}
            />
          )}
        </div>
      )}

      {!cotacao && (
        <div>
          <Button variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
};

interface ResumoDaTrocaProps {
  cotacao: CotacaoDaTroca;
  plano: Plano;
  trocando: boolean;
  erro: string | null;
  repositorio: CartaoRepository;
  onCancelar: () => void;
  onConfirmar: (pagamento?: PagamentoDaTroca) => Promise<void>;
}

/** O que a troca custa, antes de o Gerente confirmar, e como confirmar: com o cartão (há diferença a pagar) ou com um clique. */
const ResumoDaTroca: React.FC<ResumoDaTrocaProps> = ({ cotacao, plano, trocando, erro, repositorio, onCancelar, onConfirmar }) => {
  const valorMensal = <strong>{formatCurrency(cotacao.valorMensalNovo)}</strong>;

  if (cotacao.modo === 'cobranca') {
    const dias = cotacao.diasRestantes ?? 0;
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-sm text-text-primary">
          Você paga agora <strong>{formatCurrency(cotacao.diferenca)}</strong>: a diferença entre os planos, proporcional ao que
          falta do período ({dias} de {cotacao.diasDoPeriodo} dias).
        </p>
        <p className="m-0 text-sm text-text-primary">
          A partir da próxima cobrança, o plano {plano.name} custa {valorMensal} por mês.
        </p>
        <FormularioDeCartao
          rotuloDoBotao={`Pagar ${formatCurrency(cotacao.diferenca)}`}
          onToken={({ token, final }) => onConfirmar({ token, final, valorConfirmado: cotacao.diferenca })}
          onCancelar={onCancelar}
          enviando={trocando}
          erro={erro}
          repositorio={repositorio}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-text-primary">
        {cotacao.modo === 'livre' ? (
          <>
            Em teste a troca é livre: não cobra nada. O plano {plano.name} vale já e custa {valorMensal} por mês a partir da
            primeira cobrança.
          </>
        ) : (
          <>
            A diferença é pequena demais para cobrar agora. O plano {plano.name} vale já, sem cobrança, e custa {valorMensal} por
            mês a partir da próxima cobrança.
          </>
        )}
      </p>
      {erro && (
        <p role="alert" className="m-0 text-sm text-error">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void onConfirmar()} loading={trocando}>
          Trocar para {plano.name}
        </Button>
        <Button variant="ghost" onClick={onCancelar} disabled={trocando}>
          Cancelar
        </Button>
      </div>
    </div>
  );
};
