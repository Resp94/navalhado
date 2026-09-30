import type { CamposDoCartao, DadosDoTitular, ICartaoAdapter, IdsDosCampos } from '../types';

/** Adaptador falso para os testes: não fala com o Mercado Pago, só guarda o que recebeu. */
export class InMemoryCartaoAdapter implements ICartaoAdapter {
  /** Os campos que estão na tela agora, um item por formulário aberto. */
  readonly montados: IdsDosCampos[] = [];
  readonly titularesRecebidos: DadosDoTitular[] = [];
  /** Faz a montagem e a geração do token falharem com este erro. */
  falharCom: Error | null = null;
  /** Os 4 últimos dígitos que o Mercado Pago (falso) devolve junto do token. */
  finalDoCartao: string | null = '0604';

  private contadorDeTokens = 0;

  async montarCampos(ids: IdsDosCampos): Promise<CamposDoCartao> {
    if (this.falharCom) throw this.falharCom;
    this.montados.push(ids);
    let ativo = true;

    return {
      gerarToken: async (titular) => {
        if (!ativo) throw new Error('Os campos do cartão já foram desmontados.');
        if (this.falharCom) throw this.falharCom;
        this.titularesRecebidos.push(titular);
        this.contadorDeTokens += 1;
        return { token: `token-falso-${this.contadorDeTokens}`, final: this.finalDoCartao };
      },
      desmontar: () => {
        ativo = false;
        const posicao = this.montados.indexOf(ids);
        if (posicao >= 0) this.montados.splice(posicao, 1);
      },
    };
  }
}
