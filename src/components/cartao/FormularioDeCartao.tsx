import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button, Input } from '../ui';
import { cartaoRepository } from '../../modules/cartao/repositorio';
import { ErroDoCartao } from '../../modules/cartao/types';
import type { CartaoRepository } from '../../modules/cartao/CartaoRepository';
import type { CamposDoCartao, CampoDoErro, CartaoTokenizado } from '../../modules/cartao/types';

interface FormularioDeCartaoProps {
  /** O que o botão diz: "Trocar cartão" na assinatura, "Pagar a diferença" no upgrade. */
  rotuloDoBotao: string;
  /**
   * Recebe o cartão tokenizado nos campos seguros do Mercado Pago: o token e os 4 últimos dígitos.
   * Quem abriu o formulário faz o que quer com ele (trocar o cartão, cobrar) e mostra a recusa pela
   * prop `erro`.
   */
  onToken: (cartao: CartaoTokenizado) => Promise<void>;
  onCancelar?: () => void;
  /** A ação de quem abriu o formulário está em andamento. */
  enviando?: boolean;
  /** A recusa da ação de quem abriu o formulário. */
  erro?: string | null;
  repositorio?: CartaoRepository;
}

type EstadoDosCampos = 'carregando' | 'pronto' | 'erro';

const ROTULO_CLASSES = 'text-xs font-extrabold text-text-primary tracking-wide uppercase leading-tight select-none';
// O iframe do Mercado Pago pede height="100%": com altura só mínima, o navegador o faz de 150px. Altura fixa
// no campo e no iframe dentro dele. O visual é o do Input do design system (contorno de 0,8px, destaque no foco).
const CAMPO_SEGURO_CLASSES =
  'h-[42px] rounded-md bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)] transition-[box-shadow] duration-150 ease-in focus-within:shadow-[0_0_0_1.5px_var(--color-brand-primary)] px-[0.85rem] flex items-center overflow-hidden [&>iframe]:h-full [&>iframe]:w-full';

/**
 * Formulário do cartão com os campos seguros do Mercado Pago (spec 052, ticket 09). O número, a
 * validade e o código de segurança são digitados em campos que o Mercado Pago hospeda: nunca passam
 * pelo Navalhado. Aqui só ficam o nome e o documento do titular. É a peça que o upgrade (ticket 10)
 * reaproveita.
 *
 * Não usa <form>: a tela Assinatura fica dentro do formulário de Configurações, e um formulário
 * dentro de outro não é HTML válido (o navegador enviaria o de fora). Enter nos campos envia.
 */
export const FormularioDeCartao: React.FC<FormularioDeCartaoProps> = ({
  rotuloDoBotao,
  onToken,
  onCancelar,
  enviando = false,
  erro = null,
  repositorio = cartaoRepository,
}) => {
  // O SDK procura os elementos pelo id: tira os caracteres que o React põe no useId.
  const base = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const ids = { numero: `cartao-numero-${base}`, validade: `cartao-validade-${base}`, codigo: `cartao-codigo-${base}` };

  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [estado, setEstado] = useState<EstadoDosCampos>('carregando');
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);
  const [erroDoCampo, setErroDoCampo] = useState<{ campo: CampoDoErro; mensagem: string } | null>(null);
  const [gerando, setGerando] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  // Os campos seguros deste formulário. Outro formulário aberto ao mesmo tempo tem os dele.
  const camposRef = useRef<CamposDoCartao | null>(null);

  useEffect(() => {
    let cancelado = false;
    setEstado('carregando');
    setErroDeCarga(null);

    repositorio
      .montarCampos({ numero: ids.numero, validade: ids.validade, codigo: ids.codigo })
      .then((campos) => {
        // O formulário fechou antes de os campos chegarem: eles não têm mais onde ficar.
        if (cancelado) {
          campos.desmontar();
          return;
        }
        camposRef.current = campos;
        setEstado('pronto');
      })
      .catch((err) => {
        if (cancelado) return;
        setEstado('erro');
        setErroDeCarga(err instanceof ErroDoCartao ? err.message : 'Não foi possível carregar o formulário do cartão. Tente de novo.');
      });

    return () => {
      cancelado = true;
      camposRef.current?.desmontar();
      camposRef.current = null;
    };
    // Os ids não mudam durante a vida do formulário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositorio, tentativa]);

  const enviar = useCallback(async () => {
    const campos = camposRef.current;
    if (!campos || estado !== 'pronto' || gerando || enviando) return;
    setErroDoCampo(null);
    setGerando(true);
    let cartao: CartaoTokenizado;
    try {
      cartao = await campos.gerarToken({ nome, documento });
    } catch (err) {
      setGerando(false);
      if (err instanceof ErroDoCartao) setErroDoCampo({ campo: err.campo, mensagem: err.message });
      else setErroDoCampo({ campo: 'cartao', mensagem: 'Não foi possível validar o cartão. Tente de novo.' });
      return;
    }
    setGerando(false);

    try {
      await onToken(cartao);
    } catch {
      // Quem abriu o formulário mostra a recusa pela prop `erro`.
    }
  }, [estado, gerando, enviando, nome, documento, onToken]);

  const aoApertarEnter = (evento: React.KeyboardEvent) => {
    if (evento.key !== 'Enter') return;
    evento.preventDefault();
    void enviar();
  };

  const mensagemDoCampo = (campo: CampoDoErro) => (erroDoCampo?.campo === campo ? erroDoCampo.mensagem : undefined);
  const erroDoCartao = mensagemDoCampo('cartao');

  return (
    <div className="flex flex-col gap-4">
      {estado === 'erro' && erroDeCarga && (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm text-error">{erroDeCarga}</p>
          <div>
            <Button variant="outline" size="sm" onClick={() => setTentativa((n) => n + 1)}>
              Tentar de novo
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-[0.35rem]">
        <span id={`${ids.numero}-rotulo`} className={ROTULO_CLASSES}>Número do cartão</span>
        <div id={ids.numero} role="group" aria-labelledby={`${ids.numero}-rotulo`} className={CAMPO_SEGURO_CLASSES} />
      </div>

      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <div className="flex flex-col gap-[0.35rem]">
          <span id={`${ids.validade}-rotulo`} className={ROTULO_CLASSES}>Validade</span>
          <div id={ids.validade} role="group" aria-labelledby={`${ids.validade}-rotulo`} className={CAMPO_SEGURO_CLASSES} />
        </div>
        <div className="flex flex-col gap-[0.35rem]">
          <span id={`${ids.codigo}-rotulo`} className={ROTULO_CLASSES}>Código de segurança</span>
          <div id={ids.codigo} role="group" aria-labelledby={`${ids.codigo}-rotulo`} className={CAMPO_SEGURO_CLASSES} />
        </div>
      </div>

      {erroDoCartao && (
        <p role="alert" className="m-0 text-sm text-error">{erroDoCartao}</p>
      )}

      <Input
        label="Nome no cartão"
        value={nome}
        onChange={(evento) => setNome(evento.target.value)}
        onKeyDown={aoApertarEnter}
        error={mensagemDoCampo('nome')}
        autoComplete="cc-name"
        maxLength={80}
      />
      <Input
        label="CPF ou CNPJ do titular"
        value={documento}
        onChange={(evento) => setDocumento(evento.target.value)}
        onKeyDown={aoApertarEnter}
        error={mensagemDoCampo('documento')}
        inputMode="numeric"
        autoComplete="off"
        maxLength={18}
      />

      {erro && (
        <p role="alert" className="m-0 text-sm text-error">{erro}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void enviar()} disabled={estado !== 'pronto'} loading={gerando || enviando}>
          {rotuloDoBotao}
        </Button>
        {onCancelar && (
          <Button variant="ghost" onClick={onCancelar} disabled={gerando || enviando}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
};
