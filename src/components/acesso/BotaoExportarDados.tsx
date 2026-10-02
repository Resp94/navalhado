import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Download04Icon } from '@hugeicons/core-free-icons';
import { Button } from '../ui';
import { AVISO_DE_ARQUIVOS_BAIXADOS } from '../../modules/exportacao/mensagens';
import { useExportarDados } from '../../modules/exportacao/useExportarDados';

interface BotaoExportarDadosProps {
  /** Barbearia do Gerente: de quem são os dados exportados. */
  tenantId: string;
  /** Fuso da barbearia, para o dia e a hora dos arquivos. Por padrão, Brasília. */
  timezone?: string;
  fullWidth?: boolean;
}

/**
 * "Exportar dados" (spec 052, ticket 14): o Gerente baixa os clientes, os agendamentos e as comandas da barbearia em CSV, a
 * qualquer momento, inclusive com a barbearia bloqueada. Só o Gerente vê: quem monta a tela decide.
 */
export const BotaoExportarDados: React.FC<BotaoExportarDadosProps> = ({ tenantId, timezone, fullWidth }) => {
  const { exportar, exportando, erro, concluido } = useExportarDados(tenantId, timezone);

  return (
    <div className={`flex flex-col gap-2${fullWidth ? '' : ' items-start'}`}>
      <Button
        variant="outline"
        fullWidth={fullWidth}
        loading={exportando}
        leftIcon={<HugeiconsIcon icon={Download04Icon} size={16} />}
        onClick={exportar}
      >
        Exportar dados
      </Button>
      {erro && (
        <p role="alert" className="text-sm text-error m-0">
          {erro}
        </p>
      )}
      {concluido && (
        <p role="status" className="text-sm text-text-secondary m-0">
          {AVISO_DE_ARQUIVOS_BAIXADOS}
        </p>
      )}
    </div>
  );
};
