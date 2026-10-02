import React, { useState } from 'react';
import { Button, Checkbox } from '../ui';
import { TermosDaPlataformaModal } from './TermosDaPlataformaModal';
import { VERSAO_ATUAL_DOS_TERMOS, dataDaVersao } from '../../modules/termos/textos';
import type { DocumentoLegal } from '../../modules/termos/types';

interface TelaDeAceiteDosTermosProps {
  /** O aceite está sendo gravado. */
  aceitando: boolean;
  /** Por que o aceite não foi gravado, para o Gerente tentar de novo. */
  erro: string | null;
  onAceitar: () => void;
  onLogout: () => void;
}

/**
 * Tela que o Gerente vê, antes do painel e antes da tela de bloqueio, quando ainda não aceitou a versão atual dos Termos de Uso e da
 * Política de Privacidade (spec 052, ticket 16). Quem vai pagar a assinatura está contratando: o aceite vem primeiro. Ler os textos
 * não marca o aceite; o Gerente marca "Li e aceito" e confirma. Quem não quer aceitar só pode sair da conta.
 */
export const TelaDeAceiteDosTermos: React.FC<TelaDeAceiteDosTermosProps> = ({ aceitando, erro, onAceitar, onLogout }) => {
  const [aceitou, setAceitou] = useState(false);
  const [documentoAberto, setDocumentoAberto] = useState<DocumentoLegal | null>(null);

  const aoEnviar = (evento: React.FormEvent) => {
    evento.preventDefault();
    if (aceitou && !aceitando) onAceitar();
  };

  return (
    <>
      <div className="noise-overlay" />
      <main className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center p-6">
        <form
          onSubmit={aoEnviar}
          className="w-full max-w-md rounded-lg border border-border bg-bg-secondary p-8 flex flex-col gap-4 text-center shadow-md"
        >
          <h1 className="text-2xl font-semibold">Termos de Uso e Política de Privacidade</h1>
          <p className="m-0 text-text-secondary">
            Para continuar usando o Navalhado, leia e aceite os Termos de Uso e a Política de Privacidade (versão de{' '}
            {dataDaVersao(VERSAO_ATUAL_DOS_TERMOS)}).
          </p>

          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm" fullWidth onClick={() => setDocumentoAberto('termos')}>
              Ler os Termos de Uso
            </Button>
            <Button variant="outline" size="sm" fullWidth onClick={() => setDocumentoAberto('privacidade')}>
              Ler a Política de Privacidade
            </Button>
          </div>

          <div className="text-left">
            <Checkbox
              checked={aceitou}
              onChange={(evento) => setAceitou(evento.target.checked)}
              disabled={aceitando}
              label="Li e aceito os Termos de Uso e a Política de Privacidade."
            />
          </div>

          {erro && (
            <p role="alert" className="m-0 text-sm text-error">
              {erro}
            </p>
          )}

          <Button type="submit" fullWidth disabled={!aceitou} loading={aceitando}>
            {aceitando ? 'Registrando…' : 'Aceitar e continuar'}
          </Button>
          <Button variant="ghost" fullWidth onClick={onLogout}>
            Sair da conta
          </Button>
        </form>
      </main>

      {documentoAberto && (
        <TermosDaPlataformaModal isOpen onClose={() => setDocumentoAberto(null)} documento={documentoAberto} />
      )}
    </>
  );
};
