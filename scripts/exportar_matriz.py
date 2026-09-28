"""Gera os dados públicos do Painel Maranhão 2050 a partir da matriz oficial."""

from __future__ import annotations

import json
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


RAIZ = Path(__file__).resolve().parents[1]
DIRETORIO_ORIGEM = RAIZ / "data" / "origem"
ARQUIVO_PADRAO = DIRETORIO_ORIGEM / "Matriz_Maranhao2050.xlsx"
DIRETORIO_SAIDA = RAIZ / "web" / "public" / "data"

AREAS = [
    "Educação, Identidade e Cultura Transformadoras e Estruturantes",
    "Economia Próspera e Inclusiva",
    "Meio Ambiente Valorizado e Resiliente",
    "Sociedade Saudável, Segura e Justa",
    "Governança Efetiva, Conectada e Inovadora",
]


def localizar_arquivo_origem() -> Path:
    if ARQUIVO_PADRAO.exists():
        return ARQUIVO_PADRAO

    candidatos = sorted(DIRETORIO_ORIGEM.glob("*.xlsx"), key=lambda p: p.stat().st_mtime, reverse=True)
    if candidatos:
        return candidatos[0]
    raise FileNotFoundError(
        f"Nenhuma planilha .xlsx encontrada em {DIRETORIO_ORIGEM}. "
        f"Use preferencialmente o nome {ARQUIVO_PADRAO.name}."
    )


ARQUIVO_ORIGEM = localizar_arquivo_origem()


def texto(valor: Any) -> str:
    if valor is None or pd.isna(valor):
        return ""
    return str(valor).strip()


def valor_json(valor: Any) -> Any:
    if valor is None:
        return None
    if isinstance(valor, (pd.Timestamp, datetime, date)):
        return valor.isoformat()
    try:
        if pd.isna(valor):
            return None
    except TypeError:
        pass
    if hasattr(valor, "item"):
        valor = valor.item()
    if isinstance(valor, float):
        return round(valor, 6)
    if isinstance(valor, str):
        return valor.strip()
    return valor




def resolver_nome_aba(nome: str) -> str:
    """Localiza a aba ignorando espaços excedentes no início/fim do nome."""
    planilhas = pd.ExcelFile(ARQUIVO_ORIGEM).sheet_names
    for planilha in planilhas:
        if planilha.strip() == nome.strip():
            return planilha
    raise ValueError(f"Worksheet named '{nome}' not found")

def localizar_linha_cabecalho(planilha: str, cabecalhos: list[str], nrows: int = 120) -> int:
    nome_aba = resolver_nome_aba(planilha)
    bruto = pd.read_excel(ARQUIVO_ORIGEM, sheet_name=nome_aba, header=None, nrows=nrows)
    for indice, linha in bruto.iterrows():
        valores = {texto(valor) for valor in linha.tolist()}
        if all(cabecalho in valores for cabecalho in cabecalhos):
            return int(indice)
    raise ValueError(f"Não encontrei os cabeçalhos {cabecalhos} na aba '{planilha}'.")


def ler_tabela(planilha: str, cabecalhos: list[str]) -> pd.DataFrame:
    nome_aba = resolver_nome_aba(planilha)
    linha = localizar_linha_cabecalho(planilha, cabecalhos)
    dados = pd.read_excel(ARQUIVO_ORIGEM, sheet_name=nome_aba, header=linha)
    dados.columns = [texto(coluna) for coluna in dados.columns]
    dados = dados.loc[:, [coluna for coluna in dados.columns if coluna and not coluna.startswith("Unnamed")]]
    return dados.dropna(how="all")


def registros_numericos(dados: pd.DataFrame, coluna: str) -> pd.DataFrame:
    dados = dados.copy()
    dados = dados[dados[coluna].notna()]
    dados = dados[pd.to_numeric(dados[coluna], errors="coerce").notna()]
    return dados


def para_registros(dados: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        {coluna: valor_json(valor) for coluna, valor in linha.items()}
        for _, linha in dados.iterrows()
    ]


def ler_sintese() -> dict[str, Any]:
    bruto = pd.read_excel(ARQUIVO_ORIGEM, sheet_name=resolver_nome_aba("Síntese"), header=None)

    linha_entidades = localizar_linha_cabecalho("Síntese", ["Entidade", "Documentos"])
    cabecalho = [texto(v) for v in bruto.iloc[linha_entidades].tolist()]
    entidades: list[dict[str, Any]] = []
    for _, linha in bruto.iloc[linha_entidades + 1 :].iterrows():
        if texto(linha.iloc[0]) == "Como ler a matriz":
            break
        if not texto(linha.iloc[0]):
            continue
        registro = {}
        for i, nome in enumerate(cabecalho):
            if nome:
                registro[nome] = valor_json(linha.iloc[i])
        entidades.append(registro)

    linha_classificacao = localizar_linha_cabecalho("Síntese", ["Tipo de contribuição", "Definição operacional"])
    classificacoes = []
    for _, linha in bruto.iloc[linha_classificacao + 1 : linha_classificacao + 6].iterrows():
        if texto(linha.iloc[0]) and texto(linha.iloc[1]):
            classificacoes.append({"Tipo": texto(linha.iloc[0]), "Definição": texto(linha.iloc[1])})

    nota = ""
    for _, linha in bruto.iterrows():
        if texto(linha.iloc[0]) == "Nota metodológica:":
            nota = texto(linha.iloc[1])
            break

    return {"entidades": entidades, "classificacoes": classificacoes, "notaMetodologica": nota}


def ler_referencias() -> dict[str, list[dict[str, Any]]]:
    desafios_df = ler_tabela("Referência Plano", ["Nº", "Área de resultado", "Desafio estratégico"])
    desafios_df = registros_numericos(desafios_df, "Nº")
    desafios = para_registros(desafios_df[["Nº", "Área de resultado", "Desafio estratégico", "Indicador principal de apoio", "Fonte"]])

    indicadores_df = ler_tabela("Referência Plano", ["Área de resultado", "Indicador", "Último valor disponível", "Ano", "Uso na matriz"])
    indicadores_df = indicadores_df[indicadores_df["Indicador"].notna()]
    indicadores = para_registros(indicadores_df[["Área de resultado", "Indicador", "Último valor disponível", "Ano", "Uso na matriz"]])
    return {"desafios": desafios, "indicadores": indicadores}


def ler_escuta() -> list[dict[str, Any]]:
    dados = ler_tabela("Escuta Técnica", ["Nº", "Tema, ativo ou passivo identificado"])
    return para_registros(registros_numericos(dados, "Nº"))


def ler_ranking_integrado() -> list[dict[str, Any]]:
    dados = ler_tabela("Ranking Integrado", ["Posição", "Tema, ativo ou passivo"])
    dados = registros_numericos(dados, "Posição")
    candidatas = ["Subsídios técnicos", "Subsídios Técnicos", "Explicação baseada nas evidências"]
    encontrada = next((coluna for coluna in candidatas if coluna in dados.columns), None)
    if encontrada is None:
        raise ValueError("Ranking Integrado sem coluna de subsídios técnicos.")
    dados = dados.copy()
    dados["Subsídios técnicos"] = dados[encontrada]
    if encontrada != "Subsídios técnicos":
        dados = dados.drop(columns=[encontrada])
    return para_registros(dados)


def padronizar_priorizacao(dados: pd.DataFrame, proposta_final: bool = False) -> pd.DataFrame:
    renomear = {
        "Ativo ou passivo consolidado": "Tema, ativo ou passivo",
        "Área de Resultado": "Área de resultado",
        "Origem e registros integrados": "Origem",
        "Votação da escuta (registro-base)": "Votação da escuta (0–5)",
        "Adesão a desafios/lacunas (registro-base)": "Adesão desafios/lacunas (0–5)",
        "Adesão desafios/lacunas (registro-base)": "Adesão desafios/lacunas (0–5)",
        "Qualidade da informação (registro-base)": "Qualidade da informação (0–5)",
        "Factibilidade fiscal (registro-base)": "Factibilidade fiscal (0–5)",
        "Score-base consolidado (0–100)": "Score final (0–100)",
        "Prioridade consolidada": "Prioridade",
        "Fonte e localização (registros integrados)": "Fonte e localização",
    }
    dados = dados.rename(columns=renomear).copy()

    # O painel publica apenas o status final de prioridade, removendo marcadores
    # operacionais entre parênteses sem alterar os demais campos da matriz.
    if "Prioridade" in dados.columns:
        dados["Prioridade"] = (
            dados["Prioridade"]
            .astype("string")
            .str.replace(r"\s*\(validar\)\s*", "", regex=True, case=False)
            .str.strip()
        )

    # Comentários de deliberação ficam apenas na planilha de trabalho.
    if "Observações e comentários consolidados" in dados.columns:
        dados = dados.drop(columns=["Observações e comentários consolidados"])
    return dados


def ler_consolidado() -> list[dict[str, Any]]:
    dados = ler_tabela("Ranking Consolidado A&P", ["Posição", "Ativo ou passivo consolidado"])
    dados = registros_numericos(dados, "Posição")
    return para_registros(padronizar_priorizacao(dados))


def ler_proposta_final() -> list[dict[str, Any]]:
    dados = ler_tabela("Proposta Final", ["Posição", "Ativo ou passivo consolidado"])
    dados = registros_numericos(dados, "Posição")
    return para_registros(padronizar_priorizacao(dados, proposta_final=True))


def ler_criterios_ranking() -> list[dict[str, Any]]:
    bruto = pd.read_excel(ARQUIVO_ORIGEM, sheet_name=resolver_nome_aba("Ranking Integrado"), header=None, nrows=15)
    criterios = []
    for _, linha in bruto.iterrows():
        if texto(linha.iloc[0]) in {
            "Adesão aos desafios e maturidade de monitoramento",
            "Votação e contribuição da escuta",
            "Qualidade das informações",
            "Factibilidade fiscal orientativa",
        }:
            criterios.append({
                "Critério": texto(linha.iloc[0]),
                "Peso": valor_json(linha.iloc[4]),
                "Regra": texto(linha.iloc[5]),
            })
    return criterios



def numero_resumo(planilha: str, rotulo: str, padrao: int) -> int:
    bruto = pd.read_excel(ARQUIVO_ORIGEM, sheet_name=resolver_nome_aba(planilha), header=None, nrows=12)
    for i in range(bruto.shape[0]):
        for j in range(bruto.shape[1]):
            if texto(bruto.iat[i, j]) == rotulo:
                candidatos = []
                if i + 1 < bruto.shape[0]:
                    candidatos.append(bruto.iat[i + 1, j])
                if j + 1 < bruto.shape[1]:
                    candidatos.append(bruto.iat[i, j + 1])
                for valor in candidatos:
                    convertido = pd.to_numeric(pd.Series([valor]), errors="coerce").iloc[0]
                    if not pd.isna(convertido):
                        return int(convertido)
    return padrao

def contagem(registros: list[dict[str, Any]], campo: str) -> dict[str, int]:
    return dict(sorted(Counter(texto(r.get(campo)) for r in registros if texto(r.get(campo))).items()))


def salvar_json(nome: str, conteudo: Any) -> None:
    DIRETORIO_SAIDA.mkdir(parents=True, exist_ok=True)
    destino = DIRETORIO_SAIDA / f"{nome}.json"
    destino.write_text(json.dumps(conteudo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    sintese_base = ler_sintese()
    referencias = ler_referencias()
    escuta = ler_escuta()
    ranking = ler_ranking_integrado()
    consolidado = ler_consolidado()
    proposta_final = ler_proposta_final()
    criterios = ler_criterios_ranking()

    ativos_consolidados = numero_resumo("Ranking Consolidado A&P", "Ativos consolidados", sum(1 for r in consolidado if texto(r.get("Tipo")) == "Ativo"))
    passivos_consolidados = numero_resumo("Ranking Consolidado A&P", "Passivos consolidados", sum(1 for r in consolidado if texto(r.get("Tipo")) == "Passivo"))
    grupos_agregados = numero_resumo("Ranking Consolidado A&P", "Grupos agregados", 17)
    reclassificados_excluidos = numero_resumo("Ranking Consolidado A&P", "Reclassificados/excluídos", 47)
    registros_base = numero_resumo("Ranking Consolidado A&P", "Registros-base", 128)

    ativos_finais = numero_resumo("Proposta Final", "Ativos estratégicos", sum(1 for r in proposta_final if texto(r.get("Tipo")) == "Ativo"))
    passivos_finais = numero_resumo("Proposta Final", "Passivos críticos", sum(1 for r in proposta_final if texto(r.get("Tipo")) == "Passivo"))
    total_final = numero_resumo("Proposta Final", "Itens da versão final", len(proposta_final))
    alta_final = numero_resumo("Proposta Final", "Alta ou muito alta", sum(1 for r in proposta_final if "alta" in texto(r.get("Prioridade")).lower()))
    prioridade_media_final = sum(1 for r in proposta_final if texto(r.get("Prioridade")).lower() == "média")

    fases = [
        {"fase": 1, "titulo": "Recebimento e sistematização documental", "descricao": "Organização das contribuições institucionais e verificação da cobertura temática nas cinco Áreas de Resultado.", "base": f"{len(sintese_base['entidades'])} entidades com documentação sistematizada."},
        {"fase": 2, "titulo": "Classificação das contribuições", "descricao": "Enquadramento dos registros como Ativo estratégico, Passivo estratégico, Proposta ou Lacuna de cobertura.", "base": "Critérios operacionais registrados na aba Síntese."},
        {"fase": 3, "titulo": "Vinculação ao universo lógico do Plano", "descricao": "Associação analítica das evidências às Áreas de Resultado, aos 22 Desafios Estratégicos e aos indicadores de apoio e monitoramento.", "base": f"{len(referencias['desafios'])} desafios e {len(referencias['indicadores'])} indicadores de monitoramento."},
        {"fase": 4, "titulo": "Escuta Técnica das Câmaras", "descricao": "Priorização participativa dos itens predefinidos e registro de novas contribuições e observações das Câmaras Técnicas.", "base": "9 respostas válidas; frequência de seleção e avaliações de potencial/gravidade e urgência."},
        {"fase": 5, "titulo": "Ranking Integrado", "descricao": "Integração das evidências documentais, aderência ao Plano, contribuição da escuta, qualidade da informação e factibilidade fiscal orientativa.", "base": f"{len(ranking)} registros rankeados com score de 0 a 100."},
        {"fase": 6, "titulo": "Consolidação qualitativa", "descricao": "Agrupamento de itens convergentes, reclassificações, reformulação de textos e preservação da rastreabilidade das evidências de origem.", "base": f"{len(consolidado)} itens consolidados."},
        {"fase": 7, "titulo": "Proposta Final pós-GT", "descricao": "Seleção final após a rodada de trabalho do GT, incorporando os ajustes qualitativos e as decisões consolidadas na etapa final.", "base": f"{len(proposta_final)} itens finais: {ativos_finais} ativos e {passivos_finais} passivos."},
    ]

    sintese = {
        "titulo": "Síntese da revisão de Ativos e Passivos — Plano Maranhão 2050",
        "descricao": "Sistematização dos documentos recebidos, cobertura por Área de Resultado e metodologia utilizada até a Proposta Final.",
        **sintese_base,
        "fases": fases,
        "criteriosRanking": criterios,
    }

    resumo_consolidado = {
        "ativosConsolidados": ativos_consolidados,
        "passivosConsolidados": passivos_consolidados,
        "gruposAgregados": grupos_agregados,
        "reclassificadosExcluidos": reclassificados_excluidos,
        "registrosBase": registros_base,
        "regraOrdenacao": "O consolidado utiliza o maior score final original do grupo como score-base; o cruzamento qualitativo altera seleção, agregação, redação e condicionamentos, sem criar nova pontuação.",
    }
    resumo_final = {
        "ativos": ativos_finais,
        "passivos": passivos_finais,
        "total": total_final,
        "altaOuMuitoAlta": alta_final,
        "prioridadeMedia": prioridade_media_final,
        "base": "Proposta final pós-GT",
        "nota": "Versão final após a rodada de trabalho do GT. A análise e os gráficos consideram os itens selecionados na aba Proposta Final.",
    }

    metadados = {
        "titulo": "Painel Maranhão 2050 — Revisão de Ativos e Passivos",
        "geradoEm": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "fonte": ARQUIVO_ORIGEM.name,
        "registros": {
            "entidades": len(sintese_base["entidades"]),
            "desafios": len(referencias["desafios"]),
            "indicadores": len(referencias["indicadores"]),
            "rankingIntegrado": len(ranking),
            "rankingConsolidado": len(consolidado),
            "escutaTecnica": len(escuta),
            "propostaFinal": len(proposta_final),
        },
        "distribuicao": {
            "rankingPorTipo": contagem(ranking, "Tipo"),
            "consolidadoPorTipo": contagem(consolidado, "Tipo"),
            "propostaFinalPorTipo": contagem(proposta_final, "Tipo"),
            "propostaFinalPorArea": contagem(proposta_final, "Área de resultado"),
        },
        "metodologia": {
            "criterios": criterios,
            "consolidadoNota": resumo_consolidado["regraOrdenacao"],
            "nota": "A vinculação entre evidências, desafios e indicadores é analítica. A factibilidade fiscal é orientativa e não substitui orçamento, EVTEA ou análise setorial.",
        },
        "rankingConsolidadoResumo": resumo_consolidado,
        "propostaFinalResumo": resumo_final,
    }

    salvar_json("sintese", sintese)
    salvar_json("referencias-plano", referencias)
    salvar_json("escuta-tecnica", escuta)
    salvar_json("ranking-integrado", ranking)
    salvar_json("ranking-consolidado", consolidado)
    salvar_json("proposta-final", proposta_final)
    salvar_json("metadados", metadados)

    # Remove saídas legadas que não fazem parte da navegação final.
    for legado in ["ranking-consolidado-ap.json"]:
        caminho = DIRETORIO_SAIDA / legado
        if caminho.exists():
            caminho.unlink()

    print("Exportação concluída:")
    print(f"- síntese: {len(sintese_base['entidades'])} entidade(s)")
    print(f"- referências: {len(referencias['desafios'])} desafio(s) e {len(referencias['indicadores'])} indicador(es)")
    print(f"- escuta técnica: {len(escuta)} registro(s)")
    print(f"- ranking integrado: {len(ranking)} registro(s)")
    print(f"- ranking consolidado: {len(consolidado)} registro(s)")
    print(f"- proposta final: {len(proposta_final)} registro(s)")


if __name__ == "__main__":
    main()
