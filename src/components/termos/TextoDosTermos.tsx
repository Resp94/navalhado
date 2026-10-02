import React from 'react';
import { VERSAO_ATUAL_DOS_TERMOS, dataDaVersao } from '../../modules/termos/textos';
import type { TextoLegal } from '../../modules/termos/types';

interface TextoDosTermosProps {
  texto: TextoLegal;
}

/** Um dos textos da plataforma (Termos de Uso ou Política de Privacidade), com a versão e todas as seções. */
export const TextoDosTermos: React.FC<TextoDosTermosProps> = ({ texto }) => (
  <div className="max-h-[60vh] overflow-y-auto pr-2 text-sm leading-[1.6] text-text-secondary">
    <p className="mt-0 text-xs">Versão de {dataDaVersao(VERSAO_ATUAL_DOS_TERMOS)}</p>
    {texto.secoes.map((secao) => (
      <section key={secao.titulo}>
        <h4 className="mt-4 mb-1 font-semibold text-text-primary">{secao.titulo}</h4>
        {secao.paragrafos.map((paragrafo, indice) => (
          <p key={indice} className="my-2">
            {paragrafo}
          </p>
        ))}
      </section>
    ))}
  </div>
);
