# 03 — Passo 1 do Wizard: Localização e Geocodificação (Brasil + ViaCEP + Lat/Lng)

**What to build:**
A primeira etapa interativa do Wizard de Onboarding focada no preenchimento ágil e estruturado da localização física da barbearia, com escopo nacional exclusivo (Brasil como padrão fixo), consulta automática de endereço via CEP (ViaCEP), captura de número/complemento e geocodificação automática de latitude e longitude.

**Blocked by:** 02 — Gatekeeper de Onboarding & Roteamento Protegido

**Status:** done

- [x] Componente `StepLocation` renderizado no primeiro passo do Wizard `/onboarding`.
- [x] País fixado em Brasil sem dropdown de seleção desnecessário.
- [x] Campo de CEP com máscara `99999-999` e consulta automática à API ViaCEP para autopreenchimento de logradouro, bairro, cidade e estado.
- [x] Campos manuais de Número e Complemento para ajuste fino.
- [x] Resolução e captura automática de coordenadas geográficas (`latitude` e `longitude`).
- [x] Validação de formulário bloqueando avanço enquanto os campos obrigatórios de endereço não estiverem preenchidos.
- [x] Persistência intermediária dos dados no tenant ou no estado do Wizard.
