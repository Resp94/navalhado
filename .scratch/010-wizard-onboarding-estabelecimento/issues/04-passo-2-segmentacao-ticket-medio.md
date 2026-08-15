# 04 — Passo 2 do Wizard: Segmentação Comercial e Inteligência de Negócio

**What to build:**
A segunda etapa do Wizard de Onboarding que apresenta a confirmação do plano ativo e coleta métricas de inteligência de mercado e calibração de preços: exibe um card com o plano contratado (Bronze, Prata, Ouro) e sua capacidade de barbeiros, coleta o Preço Base do Corte (`base_cut_price`) e registra o canal de origem do cliente (`acquisition_channel`), propagando o valor do corte para alimentar a sugestão da etapa de serviços.

**Blocked by:** 03 — Passo 1 do Wizard: Localização e Geocodificação (Brasil + ViaCEP + Lat/Lng)

**Status:** done

- [x] Componente `StepSegmentation` renderizado no segundo passo do Wizard.
- [x] Card visual informativo com o plano ativo do tenant e indicação do limite máximo de profissionais permitidos (`max_professionals`).
- [x] Campo de entrada monetária para o Preço Base do Corte (`base_cut_price`) com máscara em Reais (`R$ 0,00`).
- [x] Dropdown de seleção do canal de aquisição (`acquisition_channel`) com opções reais (Instagram, TikTok, Google/Busca, Indicação, YouTube, Eventos).
- [x] Validação garantindo que o valor do corte seja maior que zero antes de permitir avançar.
- [x] Propagação do valor do corte para o estado compartilhado do Wizard para pré-alimentar o Passo 3.
