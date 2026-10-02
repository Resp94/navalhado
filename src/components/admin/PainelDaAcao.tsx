import React, { useState } from 'react';
import { dateInZone, shiftCalendarDate } from '../../lib/timezone';
import type { PedidoDoProprietario } from '../../modules/proprietario/useAcoesDoProprietario';
import type { DetalhesDoTenant } from '../../modules/proprietario/types';
import { Button, Input, Textarea } from '../ui';

export type TipoDeAcao = PedidoDoProprietario['tipo'];

interface PainelDaAcaoProps {
  tipo: TipoDeAcao;
  detalhes: DetalhesDoTenant;
  emAndamento: boolean;
  erro: string | null;
  aoConfirmar: (pedido: PedidoDoProprietario) => void;
  aoCancelar: () => void;
}

const TITULOS: Record<TipoDeAcao, string> = {
  estenderTeste: 'Estender o teste',
  darCortesia: 'Cortesia',
  encerrarCortesia: 'Encerrar a cortesia',
  desbloquear: 'Desbloquear',
  bloquear: 'Bloquear',
};

const CONFIRMAR: Record<TipoDeAcao, string> = {
  estenderTeste: 'estender teste',
  darCortesia: 'dar cortesia',
  encerrarCortesia: 'encerrar cortesia',
  desbloquear: 'desbloquear',
  bloquear: 'bloquear',
};

const AVISO = 'text-xs text-text-secondary leading-relaxed m-0';

/**
 * A pergunta de uma ação do Proprietário: o que ela faz, o que ela pede (o dia, o motivo) e a confirmação. Quem a recusa, se a
 * barbearia não está no estado certo ou a data não serve, é o banco; o erro dele aparece aqui. Os dias são AAAA-MM-DD no fuso da
 * barbearia, e a ação vale até o fim desse dia.
 */
export const PainelDaAcao: React.FC<PainelDaAcaoProps> = ({ tipo, detalhes, emAndamento, erro, aoConfirmar, aoCancelar }) => {
  const [dia, setDia] = useState('');
  const [motivo, setMotivo] = useState('');
  const [comFim, setComFim] = useState(false);

  const { assinatura, barbearia } = detalhes;
  const fuso = barbearia.fuso;
  const hoje = dateInZone(new Date(), fuso);
  // Estender não encurta: o teste que ainda vale só pode ir para depois do fim dele.
  const diaMinimo =
    tipo === 'estenderTeste' && assinatura?.situacao === 'trialing' && assinatura.testeAte
      ? [hoje, shiftCalendarDate(dateInZone(assinatura.testeAte, fuso), 1)].sort().at(-1)!
      : hoje;

  const motivoLimpo = motivo.trim();
  const precisaDoDia = tipo === 'estenderTeste' || tipo === 'desbloquear' || (tipo === 'darCortesia' && comFim);
  const precisaDoMotivo = tipo === 'desbloquear' || tipo === 'bloquear';
  const valido = (!precisaDoDia || dia !== '') && (!precisaDoMotivo || motivoLimpo !== '');

  const confirmar = () => {
    switch (tipo) {
      case 'estenderTeste':
        return aoConfirmar({ tipo, ate: dia });
      case 'darCortesia':
        return aoConfirmar({ tipo, ate: comFim ? dia : null });
      case 'encerrarCortesia':
        return aoConfirmar({ tipo });
      case 'desbloquear':
        return aoConfirmar({ tipo, ate: dia, motivo: motivoLimpo });
      case 'bloquear':
        return aoConfirmar({ tipo, motivo: motivoLimpo });
    }
  };

  const jaEmCortesia = assinatura?.situacao === 'courtesy';
  const rotuloDeConfirmar = tipo === 'darCortesia' && jaEmCortesia ? 'alterar cortesia' : CONFIRMAR[tipo];

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg-primary p-4" role="group" aria-label={TITULOS[tipo]}>
      <h4 className="m-0 text-sm font-extrabold text-text-primary">{tipo === 'darCortesia' && jaEmCortesia ? 'Alterar a cortesia' : TITULOS[tipo]}</h4>

      {tipo === 'estenderTeste' && (
        <>
          <Input
            type="date"
            label="Estender o teste até"
            value={dia}
            min={diaMinimo}
            onChange={(e) => setDia(e.target.value)}
            helperText={`O teste vai até o fim desse dia, no fuso da barbearia (${fuso}).`}
          />
          {assinatura?.cartao && (
            <p className={AVISO}>
              O cartão já foi autorizado no Mercado Pago: a primeira cobrança sai na data que ele marcou, e estender o teste não a muda.
            </p>
          )}
        </>
      )}

      {tipo === 'darCortesia' && (
        <>
          <p className={AVISO}>Sem cobrança e sem bloqueio enquanto a cortesia vale. Quando ela termina, a barbearia fica bloqueada.</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input type="radio" name="fim-da-cortesia" checked={!comFim} onChange={() => setComFim(false)} />
              Sem data de fim
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input type="radio" name="fim-da-cortesia" checked={comFim} onChange={() => setComFim(true)} />
              Até uma data
            </label>
          </div>
          {comFim && (
            <Input
              type="date"
              label="Cortesia até"
              value={dia}
              min={hoje}
              onChange={(e) => setDia(e.target.value)}
              helperText={`A cortesia vai até o fim desse dia, no fuso da barbearia (${fuso}).`}
            />
          )}
          {assinatura?.assinaturaNoMercadoPago && (
            <p className={AVISO}>
              Esta barbearia tem uma assinatura no Mercado Pago. A cortesia não a cancela: o cartão continua sendo cobrado até a assinatura ser
              cancelada lá.
            </p>
          )}
          {assinatura?.planoAgendado && (
            <p className={AVISO}>
              {`Há uma descida de plano agendada, para ${assinatura.planoAgendado.nome}: a cortesia a desfaz e a barbearia fica no plano atual (${assinatura.plano.nome}), mas o Mercado Pago já cobra o valor do plano menor.`}
            </p>
          )}
        </>
      )}

      {tipo === 'encerrarCortesia' && (
        <p className={AVISO}>A cortesia termina agora e a barbearia fica bloqueada (motivo: cortesia terminada).</p>
      )}

      {tipo === 'desbloquear' && (
        <>
          <p className={AVISO}>
            A barbearia volta a ter acesso, com aviso, até o fim do dia escolhido (no fuso dela). Depois, o bloqueio de antes volta a valer. Não altera
            nada no Mercado Pago; um pagamento aprovado antes disso reativa a barbearia do jeito de sempre.
          </p>
          <Input
            type="date"
            label="Liberar até"
            value={dia}
            min={hoje}
            onChange={(e) => setDia(e.target.value)}
            helperText={`O dia vale até o fim dele, no fuso da barbearia (${fuso}).`}
          />
        </>
      )}

      {tipo === 'bloquear' && (
        <p className={AVISO}>
          {detalhes.acesso.motivo === 'unblocked'
            ? 'O desbloqueio acaba agora e o bloqueio de antes volta a valer: o Gerente e os barbeiros passam a ver só a tela de bloqueio. Um pagamento aprovado depois reativa a barbearia. Não altera nada no Mercado Pago.'
            : 'O acesso fecha na hora: o Gerente e os barbeiros passam a ver só a tela de bloqueio. Um pagamento aprovado depois reativa a barbearia. Não cancela nada no Mercado Pago.'}
        </p>
      )}

      {precisaDoMotivo && (
        <Textarea
          label="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          helperText="Fica registrado na trilha de auditoria; só o Proprietário lê."
        />
      )}

      {erro && (
        <p role="alert" className="m-0 text-sm text-error">
          {erro}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={aoCancelar} disabled={emAndamento}>
          Cancelar
        </Button>
        <Button variant={tipo === 'bloquear' ? 'danger' : 'primary'} onClick={confirmar} loading={emAndamento} disabled={!valido}>
          {`Confirmar: ${rotuloDeConfirmar}`}
        </Button>
      </div>
    </div>
  );
};
