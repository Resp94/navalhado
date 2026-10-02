import React, { useState } from 'react';
import { Checkbox } from '../ui';
import { TermosDaPlataformaModal } from './TermosDaPlataformaModal';
import type { DocumentoLegal } from '../../modules/termos/types';

// O botão-link fica fora do <label> da caixa: um botão dentro de um <label> é HTML inválido.
const CLASSE_DO_LINK = 'bg-none border-none p-0 text-brand-primary underline cursor-pointer font-semibold';

interface AceiteDosTermosProps {
  aceitou: boolean;
  onChange: (aceitou: boolean) => void;
  disabled?: boolean;
}

/**
 * A caixa "Li e aceito os Termos de Uso e a Política de Privacidade." e os links que abrem os dois textos (spec 052, ticket 16).
 * Cadastro, tela de aceite e tela de bloqueio usam esta: a frase que o usuário aceita é uma só, e ler os textos não marca o aceite.
 */
export const AceiteDosTermos: React.FC<AceiteDosTermosProps> = ({ aceitou, onChange, disabled = false }) => {
  const [documentoAberto, setDocumentoAberto] = useState<DocumentoLegal | null>(null);

  return (
    <>
      <div className="flex flex-col gap-1 text-left">
        <Checkbox
          checked={aceitou}
          onChange={(evento) => onChange(evento.target.checked)}
          disabled={disabled}
          label="Li e aceito os Termos de Uso e a Política de Privacidade."
        />
        <p className="m-0 pl-[1.65rem] text-xs text-text-secondary">
          Leia os{' '}
          <button type="button" className={CLASSE_DO_LINK} onClick={() => setDocumentoAberto('termos')}>
            Termos de Uso
          </button>{' '}
          e a{' '}
          <button type="button" className={CLASSE_DO_LINK} onClick={() => setDocumentoAberto('privacidade')}>
            Política de Privacidade
          </button>
          .
        </p>
      </div>

      {documentoAberto && (
        <TermosDaPlataformaModal isOpen onClose={() => setDocumentoAberto(null)} documento={documentoAberto} />
      )}
    </>
  );
};
