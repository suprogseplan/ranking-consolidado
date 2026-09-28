# Painel Maranhão 2050 — Revisão de Ativos e Passivos

Painel web estático e interativo para apresentar a revisão de **Ativos e Passivos do Plano Maranhão 2050**, desde a sistematização documental até a **Proposta Final pós-GT**.

A navegação pública prioriza cinco leituras, nesta ordem:

1. **Proposta Final** — etapa principal do painel, com a lista final posicionada no topo da aba e 29 itens selecionados após a rodada de trabalho do GT;
2. **Síntese** — metodologia em sete fases, critérios do Ranking Integrado, classificação e cobertura das contribuições institucionais;
3. **Escuta Técnica** — resultados do formulário e contribuições adicionais das Câmaras Técnicas;
4. **Ranking Consolidado** — 39 itens após a consolidação qualitativa, com referência ao universo de 210 registros do Ranking Integrado;
5. **Referências do Plano** — Áreas de Resultado, 22 Desafios Estratégicos e indicadores usados na vinculação temática.

Fluxo de atualização:

`Matriz Excel oficial → script Python → JSON público → React/Vite → GitHub Actions → GitHub Pages`

## Repositório e endereço institucional

```text
https://github.com/suprogseplan/ranking-consolidado
```

GitHub Pages:

```text
https://suprogseplan.github.io/ranking-consolidado/
```

O `web/vite.config.ts` usa automaticamente `/ranking-consolidado/` no GitHub Actions e `/` no ambiente local.

## Base atual

A planilha atual contém e o painel publica:

```text
12 entidades com documentação sistematizada
22 desafios estratégicos
30 indicadores de monitoramento
37 registros da Escuta Técnica
210 registros do Ranking Integrado
39 itens do Ranking Consolidado
29 itens da Proposta Final
```

A **Proposta Final** reúne 12 ativos e 17 passivos. Os comentários internos de deliberação permanecem somente na planilha de trabalho e não são enviados ao site público.

Na apresentação pública, os campos de prioridade exibem diretamente o **status final** definido para cada item.

## Atualizar a matriz

Use, preferencialmente, o nome estável:

```text
data\origem\Matriz_Maranhao2050.xlsx
```

A planilha permanece no `.gitignore`, portanto não é publicada no repositório. Ao receber uma nova versão, substitua o arquivo local mantendo esse nome.

Na raiz do projeto:

```powershell
.\.venv\Scripts\python.exe scripts\exportar_matriz.py
```

O script gera em `web/public/data/`:

```text
sintese.json
referencias-plano.json
escuta-tecnica.json
ranking-integrado.json
ranking-consolidado.json
proposta-final.json
metadados.json
```

No Ranking Integrado, a coluna da matriz `Explicação baseada nas evidências` é publicada como **Subsídios técnicos**.

## Testar localmente

```powershell
cd web
npm install
npm run dev
```

Versão de produção:

```powershell
npm run build
npm run preview
```

## Publicar uma atualização

Depois de revisar os JSONs públicos:

```powershell
git status
git add scripts web README.md
git commit -m "Atualiza Proposta Final e painel Maranhão 2050"
git push origin main
```

O workflow `.github/workflows/deploy.yml` executa o build e publica automaticamente no GitHub Pages.

## Estrutura principal

```text
scripts/exportar_matriz.py       Leitura, normalização e exportação da matriz.
web/src/App.tsx                  Interface das cinco abas prioritárias.
web/src/index.css                Identidade visual e responsividade.
web/public/data/*.json           Dados efetivamente publicados.
web/vite.config.ts               Base do GitHub Pages institucional.
.github/workflows/deploy.yml     Build e publicação automática.
```

## Cuidados de publicação

GitHub Pages é ambiente público. Revise `web/public/data/` antes de cada atualização. Não publique documentos brutos, dados pessoais, respostas identificadas de formulários ou comentários internos de deliberação.

A vinculação entre evidências, desafios e indicadores é analítica. A factibilidade fiscal utilizada na etapa de ranking é orientativa e não substitui orçamento, EVTEA ou análise setorial.
