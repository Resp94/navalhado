import React, { useEffect, useState } from 'react';
import { formatCurrency } from '../../lib/currency';
import { pluralizar } from '../../lib/plural';
import {
  dataCompleta,
  rotuloDaSituacaoDaCobranca,
  rotuloDoCartao,
  rotuloDoTipoDaCobranca,
} from '../../modules/assinatura/apresentacaoDaAssinatura';
import { rotuloDaSituacao } from '../../modules/assinatura/situacaoDaAssinatura';
import {
  acoesDisponiveis,
  limiteDeProfissionaisEmVigor,
  resumoDaAcao,
  rotuloDaAcao,
  rotuloDoMotivoDoBloqueio,
  textoDoAcesso,
} from '../../modules/proprietario/apresentacao';
import type { DetalhesDoTenant as DadosDoTenant } from '../../modules/proprietario/types';
import { useAcoesDoProprietario } from '../../modules/proprietario/useAcoesDoProprietario';
import { useDetalhesDoTenant } from '../../modules/proprietario/useDetalhesDoTenant';
import { Badge, Button, Drawer } from '../ui';
import { PainelDaAcao, type TipoDeAcao } from './PainelDaAcao';

interface DetalhesDoTenantProps {
  /** A barbearia que o Proprietário abriu; nulo com a gaveta fechada. */
  tenantId: string | null;
  aoFechar: () => void;
  /** Depois de uma ação aceita pelo banco: quem montou a lista relê a linha da barbearia. */
  aoMudar: () => void;
}

const NIVEIS = {
  allowed: { rotulo: 'Liberado', variante: 'success' },
  warning: { rotulo: 'Liberado com aviso', variante: 'warning' },
  blocked: { rotulo: 'Bloqueado', variante: 'error' },
} as const;

const TITULO_DA_SECAO = 'm-0 text-xs font-extrabold uppercase tracking-wide text-text-secondary';

const limiteEmTexto = (limite: number): string => `até ${limite} ${pluralizar(limite, 'profissional', 'profissionais')}`;

const Linha: React.FC<{ rotulo: string; children: React.ReactNode }> = ({ rotulo, children }) => (
  <div className="flex justify-between gap-4 text-sm">
    <dt className="text-text-secondary shrink-0">{rotulo}</dt>
    <dd className="m-0 text-right text-text-primary break-words min-w-0">{children}</dd>
  </div>
);

/**
 * A visão de detalhe de uma barbearia em Admin > Tenants (spec 052, ticket 15): o Estado de Acesso de hoje, a assinatura, os
 * profissionais ativos, as cobranças e as ações que o Proprietário já fez nela, e as ações que o estado dela permite, cada uma
 * com a sua pergunta de confirmação. Quem decide e confere é o banco (funções `admin_*`); aqui se mostra e se pede.
 */
export const DetalhesDoTenant: React.FC<DetalhesDoTenantProps> = ({ tenantId, aoFechar, aoMudar }) => {
  const { detalhes, status, erro, recarregar } = useDetalhesDoTenant(tenantId);
  const acoes = useAcoesDoProprietario();
  const { limparErro } = acoes;
  const [pedindo, setPedindo] = useState<TipoDeAcao | null>(null);

  // Outra barbearia, outra conversa: a pergunta aberta e o erro dela não passam adiante.
  useEffect(() => {
    setPedindo(null);
  }, [tenantId]);

  const abrir = (tipo: TipoDeAcao) => {
    limparErro();
    setPedindo(tipo);
  };

  const executar = async (pedido: Parameters<typeof acoes.executar>[1]) => {
    if (!tenantId) return;
    const aceito = await acoes.executar(tenantId, pedido);
    // Uma recusa por estado (já não está bloqueada, já não é cortesia, o teste mudou) quer dizer que o que a gaveta mostra está
    // velho: relê também nesse caso, para os botões e o estado acompanharem o banco. A pergunta fica aberta, com o motivo.
    recarregar();
    if (aceito === null) return;
    setPedindo(null);
    aoMudar();
  };

  const corpo = (dados: DadosDoTenant) => {
    const { barbearia, assinatura, acesso, profissionaisAtivos, cobrancas, desbloqueio } = dados;
    const fuso = barbearia.fuso;
    const disponiveis = acoesDisponiveis(dados);
    const nivel = NIVEIS[acesso.nivel];
    const botoes: { tipo: TipoDeAcao; rotulo: string; ativo: boolean }[] = [
      { tipo: 'estenderTeste', rotulo: 'Estender teste', ativo: disponiveis.estenderTeste },
      { tipo: 'darCortesia', rotulo: assinatura?.situacao === 'courtesy' ? 'Alterar cortesia' : 'Dar cortesia', ativo: disponiveis.darCortesia },
      { tipo: 'encerrarCortesia', rotulo: 'Encerrar cortesia', ativo: disponiveis.encerrarCortesia },
      { tipo: 'desbloquear', rotulo: 'Desbloquear', ativo: disponiveis.desbloquear },
      { tipo: 'bloquear', rotulo: 'Bloquear', ativo: disponiveis.bloquear },
    ];

    return (
      <>
        <section aria-label="Barbearia" className="flex flex-col gap-1 text-sm">
          <span>{barbearia.email}</span>
          <span>{barbearia.telefone}</span>
          <span className="text-xs text-text-secondary">Cadastrada em {dataCompleta(barbearia.criadaEm, fuso)}</span>
        </section>

        <section aria-label="Acesso hoje" className="flex flex-col gap-2">
          <h4 className={TITULO_DA_SECAO}>Acesso hoje</h4>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={nivel.variante}>{nivel.rotulo}</Badge>
            <span className="text-sm text-text-primary">{textoDoAcesso(acesso, fuso)}</span>
          </div>
        </section>

        {desbloqueio && (
          <section aria-label="Desbloqueio" className="flex flex-col gap-1 rounded-lg border border-warning bg-warning-bg p-4">
            <h4 className={TITULO_DA_SECAO}>Desbloqueio manual</h4>
            <p className="m-0 text-sm text-text-primary">Desbloqueada até {dataCompleta(desbloqueio.ate, fuso)}</p>
            {desbloqueio.motivo && <p className="m-0 text-sm text-text-secondary">Motivo: {desbloqueio.motivo}</p>}
          </section>
        )}

        <section aria-label="Assinatura" className="flex flex-col gap-3">
          <h4 className={TITULO_DA_SECAO}>Assinatura</h4>
          {assinatura ? (
            <dl className="m-0 flex flex-col gap-2">
              <Linha rotulo="Plano">
                <span>{`${assinatura.plano.nome}, ${formatCurrency(assinatura.plano.preco)} por mês (${limiteEmTexto(assinatura.plano.limiteDeProfissionais)})`}</span>
              </Linha>
              {assinatura.planoAgendado && (
                <Linha rotulo="Plano agendado">
                  <span>{`${assinatura.planoAgendado.nome}, ${formatCurrency(assinatura.planoAgendado.preco)} por mês, na próxima cobrança (${limiteEmTexto(assinatura.planoAgendado.limiteDeProfissionais)})`}</span>
                </Linha>
              )}
              <Linha rotulo="Situação">{rotuloDaSituacao(assinatura.situacao)}</Linha>
              <Linha rotulo="Profissionais ativos">
                {`${profissionaisAtivos} de ${limiteDeProfissionaisEmVigor(assinatura)}${
                  limiteDeProfissionaisEmVigor(assinatura) < assinatura.plano.limiteDeProfissionais ? ' (limite do plano agendado)' : ''
                }`}
              </Linha>
              {assinatura.testeAte && <Linha rotulo="Fim do teste">{dataCompleta(assinatura.testeAte, fuso)}</Linha>}
              {assinatura.periodoAte && (
                <Linha rotulo="Período pago">
                  {assinatura.periodoDesde ? `${dataCompleta(assinatura.periodoDesde, fuso)} a ${dataCompleta(assinatura.periodoAte, fuso)}` : `até ${dataCompleta(assinatura.periodoAte, fuso)}`}
                </Linha>
              )}
              {assinatura.cortesiaAte && <Linha rotulo="Cortesia até">{dataCompleta(assinatura.cortesiaAte, fuso)}</Linha>}
              {assinatura.primeiraRecusaEm && <Linha rotulo="Primeira recusa">{dataCompleta(assinatura.primeiraRecusaEm, fuso)}</Linha>}
              {assinatura.bloqueadaEm && (
                <Linha rotulo="Bloqueada em">
                  <span>{dataCompleta(assinatura.bloqueadaEm, fuso)}</span>
                </Linha>
              )}
              {assinatura.situacao === 'blocked' && <Linha rotulo="Motivo do bloqueio">{rotuloDoMotivoDoBloqueio(assinatura.motivoDoBloqueio)}</Linha>}
              {assinatura.canceladaEm && <Linha rotulo="Cancelada em">{dataCompleta(assinatura.canceladaEm, fuso)}</Linha>}
              {assinatura.cartao && <Linha rotulo="Cartão">{rotuloDoCartao(assinatura.cartao)}</Linha>}
              {assinatura.assinaturaNoMercadoPago && <Linha rotulo="Assinatura no Mercado Pago">{assinatura.assinaturaNoMercadoPago}</Linha>}
            </dl>
          ) : (
            <p className="m-0 text-sm text-text-secondary">Esta barbearia não tem assinatura.</p>
          )}
        </section>

        {assinatura && (
          <section aria-label="Ações" className="flex flex-col gap-3">
            <h4 className={TITULO_DA_SECAO}>Ações</h4>
            <div className="flex flex-wrap gap-2">
              {botoes
                .filter((botao) => botao.ativo)
                .map((botao) => (
                  <Button
                    key={botao.tipo}
                    size="sm"
                    variant={botao.tipo === 'bloquear' ? 'danger-outline' : 'outline'}
                    disabled={pedindo !== null && pedindo !== botao.tipo}
                    onClick={() => abrir(botao.tipo)}
                  >
                    {botao.rotulo}
                  </Button>
                ))}
            </div>
            {pedindo && (
              <PainelDaAcao
                key={pedindo}
                tipo={pedindo}
                detalhes={dados}
                emAndamento={acoes.emAndamento}
                erro={acoes.erro}
                aoConfirmar={executar}
                aoCancelar={() => {
                  limparErro();
                  setPedindo(null);
                }}
              />
            )}
          </section>
        )}

        <section aria-label="Cobranças" className="flex flex-col gap-3">
          <h4 className={TITULO_DA_SECAO}>Cobranças</h4>
          {cobrancas.length === 0 ? (
            <p className="m-0 text-sm text-text-secondary">Nenhuma cobrança registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table aria-label="Cobranças" className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="text-text-secondary">
                    <th className="py-2 pr-3 font-semibold">Data</th>
                    <th className="py-2 pr-3 font-semibold">Tipo</th>
                    <th className="py-2 pr-3 font-semibold">Valor</th>
                    <th className="py-2 pr-3 font-semibold">Situação</th>
                    <th className="py-2 pr-3 font-semibold">Cartão</th>
                    <th className="py-2 font-semibold">Pagamento no Mercado Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {cobrancas.map((cobranca) => (
                    <tr key={cobranca.id} className="border-t border-border">
                      <td className="py-2 pr-3">{dataCompleta(cobranca.cobradaEm, fuso)}</td>
                      <td className="py-2 pr-3">{rotuloDoTipoDaCobranca(cobranca.tipo === 'upgrade' ? 'upgrade' : 'recurring')}</td>
                      <td className="py-2 pr-3">{formatCurrency(cobranca.valor)}</td>
                      <td className="py-2 pr-3">{rotuloDaSituacaoDaCobranca(cobranca.situacao)}</td>
                      <td className="py-2 pr-3">{rotuloDoCartao(cobranca.cartao) ?? '—'}</td>
                      <td className="py-2 break-all">{cobranca.pagamentoNoMercadoPago}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {dados.acoes.length > 0 && (
          <section aria-label="Histórico" className="flex flex-col gap-3">
            <h4 className={TITULO_DA_SECAO}>Ações do Proprietário nesta barbearia</h4>
            <ul aria-label="Ações do Proprietário" className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
              {dados.acoes.map((acao, indice) => {
                const resumo = resumoDaAcao(acao, fuso);
                return (
                  <li key={`${acao.acao}-${acao.em.getTime()}-${indice}`} className="flex flex-col">
                    <span className="font-semibold text-text-primary">{rotuloDaAcao(acao.acao)}</span>
                    <span className="text-xs text-text-secondary">
                      {dataCompleta(acao.em, fuso)}
                      {acao.por ? ` por ${acao.por}` : ''}
                      {resumo ? ` — ${resumo}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </>
    );
  };

  return (
    <Drawer
      isOpen={tenantId !== null}
      onClose={aoFechar}
      title={detalhes?.barbearia.nome ?? 'Barbearia'}
      description="Assinatura e acesso"
      width="min(96vw, 680px)"
    >
      {status === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="m-0 text-sm text-error">
            {erro}
          </p>
          <Button size="sm" variant="outline" onClick={recarregar}>
            Tentar de novo
          </Button>
        </div>
      )}
      {status === 'loading' && <p className="m-0 text-sm text-text-secondary">Carregando…</p>}
      {detalhes && status !== 'error' && corpo(detalhes)}
    </Drawer>
  );
};
