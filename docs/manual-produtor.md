# Manual do produtor — COCO SMART 360 MVP

## Iniciar e acessar

Com a API e a interface em execução, acesse `http://localhost:3000`. A faixa superior informa se a API está conectada. Em caso de erro, confira a mensagem apresentada e verifique o serviço em `http://localhost:8000/health`.

## Primeiros registros

1. Em **Minha propriedade**, cadastre nome, município, UF, área, quantidade estimada de coqueiros e variedade.
2. Em **Coqueiros**, registre um identificador por planta. Coordenadas, linha e posição são opcionais.
3. Em **Calendário de manejo**, crie atividades definidas pela propriedade ou pelo profissional responsável; conclua após a execução.
4. Em **Solo e adubação**, transcreva os dados do laudo e marque a conferência somente depois de comparar com o documento original.
5. Use a calculadora de fertilizante somente com alvos definidos em plano validado e percentuais conferidos no rótulo.
6. Em **Irrigação**, informe ETo, Kc, chuva efetiva, eficiência, área, número de plantas e, se disponíveis, os dados dos emissores. A saída é uma estimativa, não um comando.
7. Cadastre itens de estoque e colheitas para construir o histórico da propriedade.

## Demonstração

O modo de demonstração é desativado por padrão. Para habilitá-lo, defina `COCO_DEMO_MODE=true` na configuração do backend e reinicie a API. A ação **Carregar dados de demonstração** cria registros ilustrativos, com nome e faixa visual explícitos. Esses dados não devem ser usados como laudos, produção real ou orientação agronômica.

## Cuidados importantes

- Os valores históricos de adubação exibidos são referências de 2000 indicadas no escopo do projeto, não prescrições universais.
- A calculadora converte alvos informados pelo usuário; não determina necessidade, dose, parcelamento ou compatibilidade.
- Não use estimativas deste MVP para operar irrigação automatizada ou realizar pulverização.
- O cadastro de solo é manual. OCR, importação de PDF e interpretação automatizada ainda não estão implementados.
- A aplicação local ainda não tem login ou perfis. Não exponha a API na internet nem armazene dados pessoais sem controles adicionais.
- Faça backup do banco SQLite (`backend/coco_smart.db`) ou do volume PostgreSQL conforme a instalação utilizada.

