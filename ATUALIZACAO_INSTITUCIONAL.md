# Atualização final do painel — Proposta Final pós-GT

Esta versão reorganiza o painel público conforme a nova matriz oficial.

## Navegação principal

1. **Síntese** — cobertura das 12 entidades e metodologia em sete fases.
2. **Referências do Plano** — 5 Áreas de Resultado, 22 Desafios Estratégicos e 30 indicadores de monitoramento.
3. **Escuta Técnica** — resultados das 9 respostas válidas e contribuições adicionais das Câmaras Técnicas.
4. **Ranking Consolidado** — 39 itens consolidados; a base intermediária de 210 registros permanece acessível em seção expansível.
5. **Proposta Final** — aba principal e inicial do painel, com 29 itens pós-GT (12 ativos e 17 passivos).

## Dados públicos

Os JSONs públicos foram regenerados a partir da planilha `Matriz_Maranhao2050.xlsx`.

Comentários internos de deliberação da planilha não são publicados. O Ranking Integrado mantém o campo **Subsídios técnicos** para rastreabilidade.

## Publicação institucional

O Vite permanece configurado para:

```text
https://suprogseplan.github.io/ranking-consolidado/
```

Antes do push, teste localmente:

```powershell
cd web
npm install
npm run build
npm run preview
```

Depois:

```powershell
cd ..
git status
git add scripts web README.md ATUALIZACAO_INSTITUCIONAL.md
git commit -m "Atualiza Proposta Final do painel Maranhão 2050"
git push origin main
```
