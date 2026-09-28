import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import './index.css'

type Registro = Record<string, unknown>

type Fase = {
  fase: number
  titulo: string
  descricao: string
  base: string
}

type SinteseData = {
  titulo: string
  descricao: string
  entidades: Registro[]
  classificacoes: Registro[]
  notaMetodologica: string
  fases: Fase[]
  criteriosRanking: Registro[]
}

type ReferenciasData = {
  desafios: Registro[]
  indicadores: Registro[]
}

type Metadados = {
  titulo: string
  geradoEm: string
  fonte: string
  registros: Record<string, number>
  distribuicao: Record<string, Record<string, number>>
  metodologia: {
    criterios: Registro[]
    consolidadoNota: string
    nota: string
  }
  rankingConsolidadoResumo: Record<string, number | string>
  propostaFinalResumo: Record<string, number | string>
}

type Visao = 'Síntese' | 'Referências do Plano' | 'Escuta Técnica' | 'Ranking Consolidado' | 'Proposta Final'
type DirecaoOrdenacao = 'asc' | 'desc'
type ItemPaginacao = number | '…'
type CampoOrdenacao = 'Posição' | 'Tema, ativo ou passivo' | 'Área de resultado' | 'Tipo' | 'Score final (0–100)' | 'Prioridade' | 'Grau de factibilidade'

type AreaConfig = {
  chave: string
  nome: string
  nomeCurto: string
  cor: string
  ordem: number
}

const CORES_IDENTIDADE = {
  vermelho: '#D42028',
  amarelo: '#ECA820',
  turquesa: '#00A0B0',
  laranja: '#E47C2C',
  verde: '#50C08C',
  cinza: '#5C6066',
}

const AREAS: AreaConfig[] = [
  { chave: 'educa', nome: 'Educação, Identidade e Cultura Transformadoras e Estruturantes', nomeCurto: 'Educação, identidade e cultura', cor: '#F4C034', ordem: 1 },
  { chave: 'econom', nome: 'Economia Próspera e Inclusiva', nomeCurto: 'Economia', cor: '#E0382C', ordem: 2 },
  { chave: 'meio ambiente', nome: 'Meio Ambiente Valorizado e Resiliente', nomeCurto: 'Meio ambiente', cor: '#50C08C', ordem: 3 },
  { chave: 'sociedade', nome: 'Sociedade Saudável, Segura e Justa', nomeCurto: 'Sociedade', cor: '#F4A840', ordem: 4 },
  { chave: 'governan', nome: 'Governança Efetiva, Conectada e Inovadora', nomeCurto: 'Governança', cor: '#2CA4B0', ordem: 5 },
]

const VISOES: Visao[] = ['Proposta Final', 'Síntese', 'Escuta Técnica', 'Ranking Consolidado', 'Referências do Plano']

function texto(valor: unknown) {
  return String(valor ?? '').trim()
}
function prioridadePublica(valor: unknown) {
  return texto(valor)
    .replace(/\s*[\(\[]\s*validar\s*[\)\]]\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function numero(valor: unknown) {
  if (typeof valor === 'number') return valor
  const convertido = Number(texto(valor).replace(',', '.'))
  return Number.isFinite(convertido) ? convertido : 0
}

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

function configArea(valor: unknown): AreaConfig {
  const valorNormalizado = normalizar(texto(valor))
  return AREAS.find((item) => valorNormalizado.includes(normalizar(item.chave))) ?? {
    chave: valorNormalizado || 'nao informado',
    nome: texto(valor) || 'Não informado',
    nomeCurto: texto(valor) || 'Não informado',
    cor: '#7A8087',
    ordem: 99,
  }
}

function nomeArea(valor: unknown) {
  return configArea(valor).nome
}

function corArea(valor: unknown) {
  return configArea(valor).cor
}

function arquivoPublico(nome: string) {
  return `${import.meta.env.BASE_URL}data/${nome}`
}

async function carregarJson<T>(nome: string): Promise<T> {
  const resposta = await fetch(arquivoPublico(nome))
  if (!resposta.ok) throw new Error(`Não foi possível carregar ${nome}.`)
  return resposta.json() as Promise<T>
}


function selecoesDaEscuta(registro: Registro) {
  const correspondencia = texto(registro['Prioridade na escuta']).match(/Seleções:\s*(\d+)/i)
  return correspondencia ? Number(correspondencia[1]) : 0
}

function respondentesDaEscuta(registros: Registro[]) {
  const denominadores = registros.map((registro) => {
    const correspondencia = texto(registro['Prioridade na escuta']).match(/Seleções:\s*\d+\s*\/\s*(\d+)/i)
    return correspondencia ? Number(correspondencia[1]) : 0
  })
  return Math.max(0, ...denominadores)
}

function percentualDaEscuta(registro: Registro) {
  const correspondencia = texto(registro['Prioridade na escuta']).match(/Seleções:\s*(\d+)\s*\/\s*(\d+)/i)
  if (!correspondencia) return 0
  const selecoes = Number(correspondencia[1])
  const respondentes = Number(correspondencia[2])
  return respondentes > 0 ? (selecoes / respondentes) * 100 : 0
}

function valorMetricaEscuta(registro: Registro, metrica: string) {
  const correspondencia = texto(registro['Prioridade na escuta']).match(new RegExp(`${metrica}:\\s*([\\d,.]+)`, 'i'))
  return correspondencia ? numero(correspondencia[1]) : 0
}

function classeTipo(valor: unknown) {
  const tipo = normalizar(texto(valor))
  if (tipo.includes('ativo')) return 'tipo tipo--ativo'
  if (tipo.includes('passivo')) return 'tipo tipo--passivo'
  if (tipo.includes('proposta')) return 'tipo tipo--proposta'
  return 'tipo'
}

function rotuloFactibilidade(valor: string) {
  const normalizado = normalizar(valor)
  if (normalizado.includes('alta')) return 'selo selo--alta'
  if (normalizado.includes('baixa')) return 'selo selo--baixa'
  return 'selo selo--media'
}

function statusCobertura(valor: unknown) {
  const valorNormalizado = normalizar(texto(valor))
  if (valorNormalizado === 'coberta') return 'status-cobertura status-cobertura--coberta'
  if (valorNormalizado.includes('complement')) return 'status-cobertura status-cobertura--complementacao'
  return 'status-cobertura status-cobertura--nao'
}

function valorOrdenacao(registro: Registro, campo: CampoOrdenacao) {
  if (campo === 'Posição' || campo === 'Score final (0–100)') return numero(registro[campo])
  if (campo === 'Área de resultado') return nomeArea(registro[campo])
  return texto(registro[campo])
}

function ordenarRegistros(registros: Registro[], campo: CampoOrdenacao, direcao: DirecaoOrdenacao) {
  return [...registros].sort((a, b) => {
    const va = valorOrdenacao(a, campo)
    const vb = valorOrdenacao(b, campo)
    const resultado = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true, sensitivity: 'base' })
    return direcao === 'asc' ? resultado : -resultado
  })
}

function paginasVisiveis(atual: number, total: number): ItemPaginacao[] {
  if (total <= 7) return Array.from({ length: total }, (_, indice) => indice + 1)
  let inicio = Math.max(2, atual - 1)
  let fim = Math.min(total - 1, atual + 1)
  if (atual <= 4) { inicio = 2; fim = 5 }
  if (atual >= total - 3) { inicio = total - 4; fim = total - 1 }
  const itens: ItemPaginacao[] = [1]
  if (inicio > 2) itens.push('…')
  for (let pagina = inicio; pagina <= fim; pagina += 1) itens.push(pagina)
  if (fim < total - 1) itens.push('…')
  itens.push(total)
  return itens
}

function escaparCsv(valor: string) {
  return `"${valor.replace(/"/g, '""')}"`
}

function baixarCsv(registros: Registro[], nomeBase: string, colunas: Array<{ rotulo: string; campo: string }>) {
  const cabecalho = colunas.map((coluna) => escaparCsv(coluna.rotulo)).join(';')
  const linhas = registros.map((registro) => colunas.map((coluna) => {
    const valor = coluna.campo === 'Área de resultado' ? nomeArea(registro[coluna.campo]) : texto(registro[coluna.campo])
    return escaparCsv(valor)
  }).join(';'))
  const conteudo = `\uFEFF${[cabecalho, ...linhas].join('\r\n')}`
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${nomeBase}_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function AreaBadge({ valor }: { valor: unknown }) {
  return <span className="area" style={{ backgroundColor: corArea(valor) }}>{nomeArea(valor)}</span>
}

function Filtros({ area, setArea, tipo, setTipo, busca, setBusca }: {
  area: string
  setArea: (valor: string) => void
  tipo: string
  setTipo: (valor: string) => void
  busca: string
  setBusca: (valor: string) => void
}) {
  return (
    <section className="filtros filtros--tres" aria-label="Filtros do painel">
      <label>
        Área de Resultado
        <select value={area} onChange={(evento) => setArea(evento.target.value)}>
          <option value="Todas">Todas as áreas</option>
          {AREAS.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}
        </select>
      </label>
      <label>
        Tipo
        <select value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
          <option value="Todos">Todos</option>
          <option value="Ativo">Ativo</option>
          <option value="Passivo">Passivo</option>
          <option value="Proposta">Proposta</option>
        </select>
      </label>
      <label className="busca">
        Buscar tema
        <input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Ex.: logística, pobreza, inovação" />
      </label>
    </section>
  )
}

function Paginacao({ pagina, totalPaginas, totalRegistros, inicio, fim, setPagina }: {
  pagina: number
  totalPaginas: number
  totalRegistros: number
  inicio: number
  fim: number
  setPagina: (pagina: number) => void
}) {
  const paginas = paginasVisiveis(pagina, totalPaginas)
  return (
    <div className="paginacao">
      <span>Mostrando {totalRegistros === 0 ? 0 : inicio + 1}–{Math.min(fim, totalRegistros)} de {totalRegistros}</span>
      <div className="paginacao-acoes">
        <button type="button" onClick={() => setPagina(Math.max(1, pagina - 1))} disabled={pagina === 1}>←</button>
        <div className="paginacao-paginas">
          {paginas.map((item, indice) => item === '…'
            ? <span className="reticencias" key={`ret-${indice}`}>…</span>
            : <button type="button" key={item} className={`pagina-numero ${item === pagina ? 'ativa' : ''}`} onClick={() => setPagina(item)}>{item}</button>)}
        </div>
        <button type="button" onClick={() => setPagina(Math.min(totalPaginas, pagina + 1))} disabled={pagina >= totalPaginas}>→</button>
      </div>
    </div>
  )
}

function TabelaPriorizacao({ registros, campoOrdenacao, direcao, aoOrdenar, rotuloScore = 'Score-base' }: {
  registros: Registro[]
  campoOrdenacao: CampoOrdenacao
  direcao: DirecaoOrdenacao
  aoOrdenar: (campo: CampoOrdenacao) => void
  rotuloScore?: string
}) {
  function th(rotulo: string, campo: CampoOrdenacao) {
    const ativo = campoOrdenacao === campo
    return (
      <th aria-sort={ativo ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button className={`cabecalho-ordenavel ${ativo ? 'ativo' : ''}`} type="button" onClick={() => aoOrdenar(campo)}>
          <span>{rotulo}</span><span className="icone-ordenacao">{ativo ? (direcao === 'asc' ? '↑' : '↓') : '↕'}</span>
        </button>
      </th>
    )
  }

  return (
    <div className="tabela-wrap">
      <table className="tabela-priorizacao">
        <thead><tr>
          {th('Pos.', 'Posição')}{th('Ativo ou passivo', 'Tema, ativo ou passivo')}{th('Área de Resultado', 'Área de resultado')}{th('Tipo', 'Tipo')}{th(rotuloScore, 'Score final (0–100)')}{th('Prioridade', 'Prioridade')}{th('Factibilidade', 'Grau de factibilidade')}<th>Tratamento / evidências</th>
        </tr></thead>
        <tbody>
          {registros.map((registro) => (
            <tr key={`${texto(registro['Posição'])}-${texto(registro['Tema, ativo ou passivo'])}`}>
              <td className="posicao">{texto(registro['Posição'])}</td>
              <td className="tema"><strong>{texto(registro['Tema, ativo ou passivo'])}</strong></td>
              <td><AreaBadge valor={registro['Área de resultado']} /></td>
              <td><span className={classeTipo(registro.Tipo)}>{texto(registro.Tipo)}</span></td>
              <td><span className="score">{numero(registro['Score final (0–100)']).toFixed(1)}</span></td>
              <td>{prioridadePublica(registro.Prioridade)}</td>
              <td><span className={rotuloFactibilidade(texto(registro['Grau de factibilidade']))}>{texto(registro['Grau de factibilidade'])}</span></td>
              <td className="detalhes-priorizacao">
                <details>
                  <summary>Ver detalhes</summary>
                  {texto(registro['Tratamento qualitativo']) && <p><b>Tratamento qualitativo:</b> {texto(registro['Tratamento qualitativo'])}</p>}
                  <p><b>Origem e convergências:</b> {texto(registro.Origem) || 'Não informado'}</p>
                  <p><b>Desafio(s):</b> {texto(registro['Desafio(s) do Plano']) || 'Não informado'}</p>
                  <p><b>Indicador associado:</b> {texto(registro['Indicador do Plano associado']) || 'Não informado'}</p>
                  <p><b>Fonte:</b> {texto(registro['Fonte e localização']) || 'Não informado'}</p>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {registros.length === 0 && <div className="tabela-vazia">Nenhum registro corresponde aos filtros selecionados.</div>}
    </div>
  )
}

function TabelaIntegrado({ registros }: { registros: Registro[] }) {
  return (
    <div className="tabela-wrap">
      <table>
        <thead><tr><th>Pos.</th><th>Tema</th><th>Subsídios técnicos</th><th>Área de Resultado</th><th>Tipo</th><th>Origem</th><th>Score</th><th>Prioridade</th></tr></thead>
        <tbody>{registros.map((registro) => (
          <tr key={`int-${texto(registro['Posição'])}-${texto(registro['Tema, ativo ou passivo'])}`}>
            <td className="posicao">{texto(registro['Posição'])}</td>
            <td className="tema"><strong>{texto(registro['Tema, ativo ou passivo'])}</strong></td>
            <td className="subsidios-tecnicos"><details><summary>Ver subsídio</summary><p>{texto(registro['Subsídios técnicos']) || 'Não informado'}</p></details></td>
            <td><AreaBadge valor={registro['Área de resultado']} /></td>
            <td><span className={classeTipo(registro.Tipo)}>{texto(registro.Tipo)}</span></td>
            <td>{texto(registro.Origem)}</td>
            <td><span className="score">{numero(registro['Score final (0–100)']).toFixed(1)}</span></td>
            <td>{prioridadePublica(registro.Prioridade)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function App() {
  const [sintese, setSintese] = useState<SinteseData | null>(null)
  const [referencias, setReferencias] = useState<ReferenciasData | null>(null)
  const [escuta, setEscuta] = useState<Registro[]>([])
  const [rankingIntegrado, setRankingIntegrado] = useState<Registro[]>([])
  const [consolidado, setConsolidado] = useState<Registro[]>([])
  const [propostaFinal, setPropostaFinal] = useState<Registro[]>([])
  const [metadados, setMetadados] = useState<Metadados | null>(null)
  const [visao, setVisao] = useState<Visao>('Proposta Final')
  const [erro, setErro] = useState('')

  const [area, setArea] = useState('Todas')
  const [tipo, setTipo] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [areaReferencia, setAreaReferencia] = useState('Todas')
  const [buscaReferencia, setBuscaReferencia] = useState('')

  const [paginaConsolidado, setPaginaConsolidado] = useState(1)
  const [paginaFinal, setPaginaFinal] = useState(1)
  const [paginaIntegrado, setPaginaIntegrado] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(15)
  const [campoConsolidado, setCampoConsolidado] = useState<CampoOrdenacao>('Score final (0–100)')
  const [direcaoConsolidado, setDirecaoConsolidado] = useState<DirecaoOrdenacao>('desc')
  const [campoFinal, setCampoFinal] = useState<CampoOrdenacao>('Posição')
  const [direcaoFinal, setDirecaoFinal] = useState<DirecaoOrdenacao>('asc')

  useEffect(() => {
    Promise.all([
      carregarJson<SinteseData>('sintese.json'),
      carregarJson<ReferenciasData>('referencias-plano.json'),
      carregarJson<Registro[]>('escuta-tecnica.json'),
      carregarJson<Registro[]>('ranking-integrado.json'),
      carregarJson<Registro[]>('ranking-consolidado.json'),
      carregarJson<Registro[]>('proposta-final.json'),
      carregarJson<Metadados>('metadados.json'),
    ])
      .then(([s, r, e, ri, c, pf, m]) => {
        setSintese(s); setReferencias(r); setEscuta(e); setRankingIntegrado(ri); setConsolidado(c); setPropostaFinal(pf); setMetadados(m)
      })
      .catch((causa: Error) => setErro(causa.message))
  }, [])

  const filtrar = (registros: Registro[]) => registros
    .filter((registro) => area === 'Todas' || texto(registro['Área de resultado']) === area)
    .filter((registro) => tipo === 'Todos' || texto(registro.Tipo) === tipo)
    .filter((registro) => normalizar(texto(registro['Tema, ativo ou passivo'] ?? registro['Tema, ativo ou passivo identificado'])).includes(normalizar(busca)))

  const consolidadoFiltrado = useMemo(() => filtrar(consolidado), [consolidado, area, tipo, busca])
  const finalFiltrado = useMemo(() => filtrar(propostaFinal), [propostaFinal, area, tipo, busca])
  const integradoFiltrado = useMemo(() => filtrar(rankingIntegrado), [rankingIntegrado, area, tipo, busca])

  const consolidadoOrdenado = useMemo(() => ordenarRegistros(consolidadoFiltrado, campoConsolidado, direcaoConsolidado), [consolidadoFiltrado, campoConsolidado, direcaoConsolidado])
  const finalOrdenado = useMemo(() => ordenarRegistros(finalFiltrado, campoFinal, direcaoFinal), [finalFiltrado, campoFinal, direcaoFinal])
  const integradoOrdenado = useMemo(() => ordenarRegistros(integradoFiltrado, 'Score final (0–100)', 'desc'), [integradoFiltrado])

  const totalPaginasConsolidado = Math.max(1, Math.ceil(consolidadoOrdenado.length / itensPorPagina))
  const inicioConsolidado = (paginaConsolidado - 1) * itensPorPagina
  const fimConsolidado = inicioConsolidado + itensPorPagina
  const consolidadoPaginado = consolidadoOrdenado.slice(inicioConsolidado, fimConsolidado)

  const totalPaginasFinal = Math.max(1, Math.ceil(finalOrdenado.length / itensPorPagina))
  const inicioFinal = (paginaFinal - 1) * itensPorPagina
  const fimFinal = inicioFinal + itensPorPagina
  const finalPaginado = finalOrdenado.slice(inicioFinal, fimFinal)

  const totalPaginasIntegrado = Math.max(1, Math.ceil(integradoOrdenado.length / 25))
  const inicioIntegrado = (paginaIntegrado - 1) * 25
  const fimIntegrado = inicioIntegrado + 25
  const integradoPaginado = integradoOrdenado.slice(inicioIntegrado, fimIntegrado)

  useEffect(() => { setPaginaConsolidado(1); setPaginaFinal(1); setPaginaIntegrado(1) }, [area, tipo, busca, itensPorPagina])

  function alternarOrdenacao(campo: CampoOrdenacao, conjunto: 'consolidado' | 'final') {
    if (conjunto === 'consolidado') {
      setPaginaConsolidado(1)
      if (campo === campoConsolidado) setDirecaoConsolidado((d) => d === 'asc' ? 'desc' : 'asc')
      else { setCampoConsolidado(campo); setDirecaoConsolidado(campo === 'Score final (0–100)' ? 'desc' : 'asc') }
    } else {
      setPaginaFinal(1)
      if (campo === campoFinal) setDirecaoFinal((d) => d === 'asc' ? 'desc' : 'asc')
      else { setCampoFinal(campo); setDirecaoFinal(campo === 'Score final (0–100)' ? 'desc' : 'asc') }
    }
  }

  const desafiosFiltrados = useMemo(() => (referencias?.desafios ?? [])
    .filter((r) => areaReferencia === 'Todas' || texto(r['Área de resultado']) === areaReferencia)
    .filter((r) => normalizar(`${texto(r['Desafio estratégico'])} ${texto(r['Indicador principal de apoio'])}`).includes(normalizar(buscaReferencia))), [referencias, areaReferencia, buscaReferencia])

  const indicadoresFiltrados = useMemo(() => (referencias?.indicadores ?? [])
    .filter((r) => areaReferencia === 'Todas' || texto(r['Área de resultado']) === areaReferencia)
    .filter((r) => normalizar(`${texto(r.Indicador)} ${texto(r['Uso na matriz'])}`).includes(normalizar(buscaReferencia))), [referencias, areaReferencia, buscaReferencia])

  const participantesEscuta = useMemo(() => respondentesDaEscuta(escuta), [escuta])
  const eleitosEscuta = useMemo(() => escuta.filter((r) => selecoesDaEscuta(r) > 0), [escuta])
  const ativosEscuta = useMemo(() => filtrar(eleitosEscuta.filter((r) => texto(r.Tipo) === 'Ativo')).sort((a,b) => selecoesDaEscuta(b)-selecoesDaEscuta(a)), [eleitosEscuta, area, tipo, busca])
  const passivosEscuta = useMemo(() => filtrar(eleitosEscuta.filter((r) => texto(r.Tipo) === 'Passivo')).sort((a,b) => selecoesDaEscuta(b)-selecoesDaEscuta(a)), [eleitosEscuta, area, tipo, busca])
  const adicionaisEscuta = useMemo(() => filtrar(escuta.filter((r) => texto(r['Prioridade na escuta']).includes('Sem avaliação numérica'))), [escuta, area, tipo, busca])

  const opcoesGraficoEscuta = (registros: Registro[], titulo: string): EChartsOption => ({
    color: [titulo === 'Ativos' ? CORES_IDENTIDADE.turquesa : CORES_IDENTIDADE.vermelho],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 12, right: 20, top: 18, bottom: 112, containLabel: true },
    xAxis: { type: 'category', data: registros.slice(0, 10).map((r) => texto(r['Tema, ativo ou passivo identificado'])), axisLabel: { rotate: 35, width: 105, overflow: 'truncate' } },
    yAxis: { type: 'value', minInterval: 1, name: 'Seleções' },
    series: [{ type: 'bar', barMaxWidth: 42, data: registros.slice(0,10).map((r) => selecoesDaEscuta(r)), itemStyle: { borderRadius: [7,7,0,0] } }],
  })

  const graficoFinalAreas: EChartsOption = useMemo(() => {
    const areas = AREAS.map((a) => a.nome)
    return {
      color: [CORES_IDENTIDADE.turquesa, CORES_IDENTIDADE.vermelho],
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0 },
      grid: { left: 12, right: 28, top: 18, bottom: 42, containLabel: true },
      xAxis: { type: 'value', minInterval: 1, name: 'Itens finais' },
      yAxis: {
        type: 'category',
        inverse: true,
        data: AREAS.map((a) => a.nome),
        axisLabel: { interval: 0, width: 270, overflow: 'break', lineHeight: 15, fontSize: 11 },
      },
      series: [
        { name: 'Ativos', type: 'bar', stack: 'tipo', barMaxWidth: 30, data: areas.map((a) => propostaFinal.filter((r) => texto(r['Área de resultado']) === a && texto(r.Tipo) === 'Ativo').length), itemStyle: { borderRadius: [6,0,0,6] } },
        { name: 'Passivos', type: 'bar', stack: 'tipo', barMaxWidth: 30, data: areas.map((a) => propostaFinal.filter((r) => texto(r['Área de resultado']) === a && texto(r.Tipo) === 'Passivo').length), itemStyle: { borderRadius: [0,6,6,0] } },
      ],
    }
  }, [propostaFinal])

  const graficoConsolidado: EChartsOption = useMemo(() => ({
    color: AREAS.map((a) => a.cor), tooltip: { trigger: 'item' }, legend: { bottom: 0 },
    series: [{ type: 'pie', radius: ['50%','76%'], label: { formatter: '{b}: {c}' }, data: AREAS.map((a) => ({ name: a.nomeCurto, value: consolidado.filter((r) => texto(r['Área de resultado']) === a.nome).length })) }],
  }), [consolidado])

  const topAtivosFinal = useMemo(() => propostaFinal.filter((r) => texto(r.Tipo) === 'Ativo').sort((a,b) => numero(b['Score final (0–100)']) - numero(a['Score final (0–100)'])).slice(0,7), [propostaFinal])
  const topPassivosFinal = useMemo(() => propostaFinal.filter((r) => texto(r.Tipo) === 'Passivo').sort((a,b) => numero(b['Score final (0–100)']) - numero(a['Score final (0–100)'])).slice(0,7), [propostaFinal])

  function graficoTopFinal(registros: Registro[], tipoGrafico: 'Ativos' | 'Passivos'): EChartsOption {
    return {
      color: [tipoGrafico === 'Ativos' ? CORES_IDENTIDADE.turquesa : CORES_IDENTIDADE.vermelho],
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 8, right: 28, top: 12, bottom: 26, containLabel: true },
      xAxis: { type: 'value', min: 0, max: 100, name: 'Score-base' },
      yAxis: { type: 'category', inverse: true, data: registros.map((r) => texto(r['Tema, ativo ou passivo'])), axisLabel: { width: 180, overflow: 'truncate' } },
      series: [{ type: 'bar', barMaxWidth: 24, data: registros.map((r) => numero(r['Score final (0–100)'])), itemStyle: { borderRadius: [0,6,6,0] }, label: { show: true, position: 'right', formatter: '{c}' } }],
    }
  }

  if (erro) return <main className="estado"><h1>Painel indisponível</h1><p>{erro}</p></main>
  if (!sintese || !referencias || !metadados) return <main className="estado"><p>Carregando dados da matriz…</p></main>

  const dataGeracao = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(metadados.geradoEm))
  const finalResumo = metadados.propostaFinalResumo
  const consolidadoResumo = metadados.rankingConsolidadoResumo
  const maiorAreaFinal = AREAS.map((a) => ({ area: a, total: propostaFinal.filter((r) => texto(r['Área de resultado']) === a.nome).length })).sort((a,b) => b.total-a.total)[0]
  const socialFinal = propostaFinal.filter((r) => texto(r['Área de resultado']) === AREAS[3].nome)
  const socialPassivos = socialFinal.filter((r) => texto(r.Tipo) === 'Passivo').length
  const socialAtivos = socialFinal.filter((r) => texto(r.Tipo) === 'Ativo').length

  const colunasCsv = [
    { rotulo: 'Posição', campo: 'Posição' }, { rotulo: 'Tipo', campo: 'Tipo' }, { rotulo: 'Ativo ou passivo', campo: 'Tema, ativo ou passivo' },
    { rotulo: 'Área de Resultado', campo: 'Área de resultado' }, { rotulo: 'Score-base', campo: 'Score final (0–100)' }, { rotulo: 'Prioridade', campo: 'Prioridade' },
    { rotulo: 'Factibilidade', campo: 'Grau de factibilidade' }, { rotulo: 'Tratamento qualitativo', campo: 'Tratamento qualitativo' },
    { rotulo: 'Desafio(s)', campo: 'Desafio(s) do Plano' }, { rotulo: 'Indicador', campo: 'Indicador do Plano associado' }, { rotulo: 'Fonte', campo: 'Fonte e localização' },
  ]

  return (
    <main className="painel">
      <header className="cabecalho">
        <div className="cabecalho-conteudo">
          <div className="marca">
            <span className="marca-simbolo" aria-hidden="true"><i /><i /><i /></span>
            <div>
              <p className="sobretitulo">PLANO MARANHÃO 2050</p>
              <h1>Revisão de Ativos e Passivos</h1>
              <p className="subtitulo">Síntese técnica, escuta, consolidação e Proposta Final · Base atualizada em {dataGeracao}</p>
            </div>
          </div>
          <div className="cabecalho-meta">
            <figure className="identidade-plano"><img src={`${import.meta.env.BASE_URL}identidade-plano-maranhao-2050.png`} alt="Identidade visual do Plano Maranhão 2050" /></figure>
            <strong className="selo-base">{metadados.registros.propostaFinal}</strong>
            <span className="selo-legenda">itens na proposta final</span>
          </div>
        </div>
        <div className="faixa-identidade" aria-hidden="true"><span /><span /><span /><span /><span /></div>
      </header>

      <nav className="navegacao navegacao--final" aria-label="Seções do painel">
        {VISOES.map((item) => (
          <button key={item} className={`${visao === item ? 'ativo' : ''} ${item === 'Proposta Final' ? 'nav-prioritaria' : ''}`} onClick={() => setVisao(item)}>
            {item}{item === 'Proposta Final' && <span className="badge-final-nav">FINAL</span>}
          </button>
        ))}
      </nav>

      {visao === 'Síntese' && (
        <>
          <section className="titulo-secao">
            <div><span className="etiqueta">SÍNTESE</span><h2>Como a Proposta Final foi construída</h2></div>
            <p>{sintese.descricao}</p>
          </section>

          <section className="cartao">
            <div className="cartao-titulo"><span className="barra-titulo barra-titulo--vermelho" /><div><h2>1. Metodologia em sete fases</h2><p>Do recebimento das evidências à seleção final pós-GT, com rastreabilidade entre as etapas.</p></div></div>
            <div className="metodo-fluxo">{sintese.fases.map((fase) => <article key={fase.fase} className={`fase-card ${fase.fase === 7 ? 'fase-card--final' : ''}`}><span className="fase-numero">{fase.fase}</span><div><h3>{fase.titulo}</h3><p>{fase.descricao}</p><small>{fase.base}</small></div></article>)}</div>
          </section>

          <section className="grade-graficos grade-metodo">
            <article className="cartao">
              <div className="cartao-titulo"><span className="barra-titulo barra-titulo--amarelo" /><div><h2>2. Critérios do Ranking Integrado</h2><p>Pesos aplicados à etapa quantitativa intermediária.</p></div></div>
              <div className="pesos">{sintese.criteriosRanking.map((criterio, indice) => <article key={texto(criterio.Critério)} style={{ borderTopColor: [CORES_IDENTIDADE.vermelho,CORES_IDENTIDADE.turquesa,CORES_IDENTIDADE.amarelo,CORES_IDENTIDADE.laranja][indice] }}><strong>{Math.round(numero(criterio.Peso)*100)}%</strong><span>{texto(criterio.Critério)}</span><small>{texto(criterio.Regra)}</small></article>)}</div>
            </article>
            <article className="cartao">
              <div className="cartao-titulo"><span className="barra-titulo barra-titulo--laranja" /><div><h2>Classificação das contribuições</h2><p>A natureza do item orienta a leitura, mas não altera automaticamente a pontuação.</p></div></div>
              <div className="classificacoes-grid">{sintese.classificacoes.map((item) => <article key={texto(item.Tipo)}><strong>{texto(item.Tipo)}</strong><p>{texto(item.Definição)}</p></article>)}</div>
            </article>
          </section>

          <section className="cartao">
            <div className="cartao-titulo"><span className="barra-titulo barra-titulo--turquesa" /><div><h2>3. Cobertura das contribuições institucionais</h2><p>Resumo dos documentos recebidos e sua incidência nas cinco Áreas de Resultado.</p></div></div>
            <div className="tabela-wrap cobertura-matriz"><table><thead><tr><th>Entidade</th><th>Documentos sistematizados</th>{AREAS.map((a) => <th key={a.nome}>{a.nome}</th>)}</tr></thead><tbody>
              {sintese.entidades.map((entidade) => <tr key={texto(entidade.Entidade)}><td><strong>{texto(entidade.Entidade)}</strong></td><td className="documentos-entidade">{texto(entidade.Documentos)}</td>{AREAS.map((a) => <td key={a.nome}><span className={statusCobertura(entidade[a.nome])}>{texto(entidade[a.nome])}</span></td>)}</tr>)}
            </tbody></table></div>
          </section>

          <section className="titulo-secao titulo-secao--interno">
            <div><span className="etiqueta">4. CONTRIBUIÇÕES</span><h2>Quem contribuiu e como a proposta foi construída</h2></div>
            <p>A síntese numérica permite acompanhar a passagem da documentação recebida até o conjunto final pós-GT.</p>
          </section>
          <section className="cards cards--seis">
            <article className="card-kpi card-kpi--turquesa"><span>Entidades com documentos</span><strong>{metadados.registros.entidades}</strong></article>
            <article className="card-kpi card-kpi--amarelo"><span>Áreas de Resultado</span><strong>5</strong></article>
            <article className="card-kpi card-kpi--laranja"><span>Desafios estratégicos</span><strong>{metadados.registros.desafios}</strong></article>
            <article className="card-kpi card-kpi--turquesa"><span>Registros integrados</span><strong>{metadados.registros.rankingIntegrado}</strong></article>
            <article className="card-kpi card-kpi--vermelho"><span>Ranking consolidado</span><strong>{metadados.registros.rankingConsolidado}</strong></article>
            <article className="card-kpi card-kpi--destaque"><span>Proposta Final</span><strong>{metadados.registros.propostaFinal}</strong></article>
          </section>
          <aside className="aviso"><strong>Nota metodológica.</strong> {sintese.notaMetodologica}</aside>
        </>
      )}

      {visao === 'Referências do Plano' && (
        <>
          <section className="titulo-secao"><div><span className="etiqueta">REFERÊNCIAS DO PLANO</span><h2>Universo lógico e vinculações utilizadas na análise</h2></div><p>As evidências foram vinculadas às Áreas de Resultado, aos 22 desafios e aos indicadores de apoio e monitoramento.</p></section>
          <section className="referencia-fluxo"><div className="fluxo-no">5 Áreas de Resultado</div><span>→</span><div className="fluxo-no">22 Desafios Estratégicos</div><span>→</span><div className="fluxo-no">30 Indicadores de monitoramento</div><span>→</span><div className="fluxo-no fluxo-no--final">Evidências e priorização</div></section>
          <section className="filtros filtros--referencias"><label>Área de Resultado<select value={areaReferencia} onChange={(e) => setAreaReferencia(e.target.value)}><option value="Todas">Todas as áreas</option>{AREAS.map((a) => <option key={a.nome}>{a.nome}</option>)}</select></label><label>Buscar desafio ou indicador<input value={buscaReferencia} onChange={(e) => setBuscaReferencia(e.target.value)} placeholder="Ex.: saneamento, inovação, educação" /></label></section>
          <section className="cartao"><div className="cartao-titulo"><span className="barra-titulo barra-titulo--turquesa" /><div><h2>Desafios estratégicos e indicador principal de apoio</h2><p>{desafiosFiltrados.length} desafio(s) no recorte atual.</p></div></div><div className="desafios-grid">{desafiosFiltrados.map((desafio) => <article className="desafio-card" key={texto(desafio['Nº'])}><span className="desafio-numero" style={{ backgroundColor: corArea(desafio['Área de resultado']) }}>{texto(desafio['Nº'])}</span><div><AreaBadge valor={desafio['Área de resultado']} /><h3>{texto(desafio['Desafio estratégico'])}</h3><p><b>Indicador principal:</b> {texto(desafio['Indicador principal de apoio'])}</p><small>{texto(desafio.Fonte)}</small></div></article>)}</div></section>
          <section className="cartao"><div className="cartao-titulo"><span className="barra-titulo barra-titulo--amarelo" /><div><h2>Indicadores de monitoramento usados na vinculação temática</h2><p>{indicadoresFiltrados.length} indicador(es) no recorte atual.</p></div></div><div className="tabela-wrap"><table><thead><tr><th>Área de Resultado</th><th>Indicador</th><th>Último valor</th><th>Ano</th><th>Uso na matriz</th></tr></thead><tbody>{indicadoresFiltrados.map((r) => <tr key={`${texto(r['Área de resultado'])}-${texto(r.Indicador)}`}><td><AreaBadge valor={r['Área de resultado']} /></td><td><strong>{texto(r.Indicador)}</strong></td><td>{texto(r['Último valor disponível'])}</td><td>{texto(r.Ano)}</td><td>{texto(r['Uso na matriz'])}</td></tr>)}</tbody></table></div></section>
        </>
      )}

      {visao === 'Escuta Técnica' && (
        <>
          <section className="titulo-secao"><div><span className="etiqueta">ESCUTA TÉCNICA</span><h2>Resultados do formulário e contribuições das Câmaras Técnicas</h2></div><p>A frequência de seleção define a priorização dos itens predefinidos; contribuições livres permanecem registradas separadamente.</p></section>
          <section className="cards"><article className="card-kpi card-kpi--turquesa"><span>Respostas válidas</span><strong>{participantesEscuta}</strong></article><article className="card-kpi card-kpi--amarelo"><span>Ativos com seleção</span><strong>{escuta.filter((r) => texto(r.Tipo)==='Ativo' && selecoesDaEscuta(r)>0).length}</strong></article><article className="card-kpi card-kpi--vermelho"><span>Passivos com seleção</span><strong>{escuta.filter((r) => texto(r.Tipo)==='Passivo' && selecoesDaEscuta(r)>0).length}</strong></article><article className="card-kpi card-kpi--laranja"><span>Contribuições adicionais</span><strong>{escuta.filter((r) => texto(r['Prioridade na escuta']).includes('Sem avaliação numérica')).length}</strong></article></section>
          <Filtros area={area} setArea={setArea} tipo={tipo} setTipo={setTipo} busca={busca} setBusca={setBusca} />
          <section className="grade-graficos"><article className="cartao"><div className="cartao-titulo"><span className="barra-titulo barra-titulo--turquesa" /><div><h2>Ativos mais selecionados</h2><p>Número de participantes que selecionaram o ativo entre as prioridades.</p></div></div><ReactECharts option={opcoesGraficoEscuta(ativosEscuta,'Ativos')} style={{height:390}} /></article><article className="cartao"><div className="cartao-titulo"><span className="barra-titulo barra-titulo--vermelho" /><div><h2>Passivos mais selecionados</h2><p>Número de participantes que selecionaram o passivo entre as prioridades.</p></div></div><ReactECharts option={opcoesGraficoEscuta(passivosEscuta,'Passivos')} style={{height:390}} /></article></section>
          <section className="cartao"><div className="cartao-titulo"><span className="barra-titulo barra-titulo--turquesa" /><div><h2>Itens priorizados na escuta</h2><p>Seleções, avaliação técnica declarada e vínculo analítico ao Plano.</p></div></div><div className="tabela-wrap"><table><thead><tr><th>Tipo</th><th>Tema</th><th>Área de Resultado</th><th>Seleções</th><th>Potencial / gravidade</th><th>Urgência</th><th>Desafio relacionado</th></tr></thead><tbody>{[...ativosEscuta,...passivosEscuta].sort((a,b)=>selecoesDaEscuta(b)-selecoesDaEscuta(a)).map((r) => { const tipoItem=texto(r.Tipo); const metrica=tipoItem==='Ativo'?'Potencial médio':'Gravidade média'; return <tr key={texto(r['Nº'])}><td><span className={classeTipo(tipoItem)}>{tipoItem}</span></td><td className="tema"><strong>{texto(r['Tema, ativo ou passivo identificado'])}</strong><details><summary>Ver evidência</summary><p>{texto(r['Evidência da escuta'])}</p><p><b>Fonte:</b> {texto(r['Fonte e localização'])}</p></details></td><td><AreaBadge valor={r['Área de resultado']} /></td><td className="dados-escuta"><span className="score">{selecoesDaEscuta(r)}/{participantesEscuta}</span><small>{percentualDaEscuta(r).toFixed(0)}%</small></td><td>{valorMetricaEscuta(r,metrica).toFixed(2)}</td><td>{valorMetricaEscuta(r,'Urgência média').toFixed(2)}</td><td>{texto(r['Desafio do Plano relacionado'])}</td></tr> })}</tbody></table></div></section>
          <section className="cartao"><div className="cartao-titulo"><span className="barra-titulo barra-titulo--laranja" /><div><h2>Contribuições adicionais das Câmaras Técnicas</h2><p>Novos ativos, passivos, propostas e observações sem avaliação numérica própria.</p></div></div><div className="contribuicoes-grid">{adicionaisEscuta.map((r) => <article className="contribuicao-card" key={texto(r['Nº'])} style={{borderTopColor:corArea(r['Área de resultado'])}}><div className="contribuicao-topo"><span className={classeTipo(r.Tipo)}>{texto(r.Tipo)}</span><AreaBadge valor={r['Área de resultado']} /></div><h3>{texto(r['Tema, ativo ou passivo identificado'])}</h3><p>{texto(r['Evidência da escuta'])}</p><details><summary>Ver vínculo e fonte</summary><p><b>Desafio:</b> {texto(r['Desafio do Plano relacionado'])}</p><p><b>Indicador:</b> {texto(r['Indicador do Plano associado'])}</p><p><b>Fonte:</b> {texto(r['Fonte e localização'])}</p></details></article>)}</div></section>
        </>
      )}

      {visao === 'Ranking Consolidado' && (
        <>
          <section className="titulo-secao"><div><span className="etiqueta">RANKING CONSOLIDADO</span><h2>Consolidação qualitativa dos ativos e passivos</h2></div><p>Etapa de agrupamento, reclassificação e reformulação que reduz a base intermediária para itens comparáveis e rastreáveis.</p></section>
          <section className="cards cards--cinco"><article className="card-kpi card-kpi--turquesa"><span>Ativos consolidados</span><strong>{texto(consolidadoResumo.ativosConsolidados)}</strong></article><article className="card-kpi card-kpi--vermelho"><span>Passivos consolidados</span><strong>{texto(consolidadoResumo.passivosConsolidados)}</strong></article><article className="card-kpi card-kpi--amarelo"><span>Itens consolidados</span><strong>{metadados.registros.rankingConsolidado}</strong><small className="card-kpi-subinfo"><b>{metadados.registros.rankingIntegrado}</b> propostas/contribuições no universo total</small></article><article className="card-kpi card-kpi--laranja"><span>Grupos agregados</span><strong>{texto(consolidadoResumo.gruposAgregados)}</strong></article><article className="card-kpi card-kpi--vermelho"><span>Registros-base</span><strong>{texto(consolidadoResumo.registrosBase)}</strong></article></section>
          <Filtros area={area} setArea={setArea} tipo={tipo} setTipo={setTipo} busca={busca} setBusca={setBusca} />
          <section className="grade-graficos"><article className="cartao"><div className="cartao-titulo"><span className="barra-titulo barra-titulo--turquesa" /><div><h2>Distribuição dos itens consolidados</h2><p>Participação das cinco Áreas de Resultado no conjunto consolidado.</p></div></div><ReactECharts option={graficoConsolidado} style={{height:330}} /></article><article className="cartao cartao-explicativo"><h3>Como ler esta etapa</h3><p>O score-base preserva o maior score final original do grupo. A revisão qualitativa altera seleção, agregação, redação e condicionamentos, mas não cria uma nova pontuação.</p><div className="mini-fluxo"><span>210 registros integrados</span><b>→</b><span>128 registros-base analisados</span><b>→</b><span className="mini-fluxo-final">39 itens consolidados</span></div></article></section>
          <section className="cartao"><div className="ranking-controles"><div className="ranking-resumo"><span><strong>{consolidadoOrdenado.length}</strong> registro(s) encontrado(s)</span><small>Ordenação interativa pelas colunas da tabela.</small></div><div className="ranking-acoes"><button className="botao-exportar" type="button" onClick={() => baixarCsv(consolidadoOrdenado,'ranking_consolidado_maranhao_2050',colunasCsv)}>↓ Exportar CSV</button><label>Exibir<select value={itensPorPagina} onChange={(e)=>setItensPorPagina(Number(e.target.value))}><option value={10}>10</option><option value={15}>15</option><option value={25}>25</option><option value={50}>50</option></select> por página</label></div></div><TabelaPriorizacao registros={consolidadoPaginado} campoOrdenacao={campoConsolidado} direcao={direcaoConsolidado} aoOrdenar={(c)=>alternarOrdenacao(c,'consolidado')} /><Paginacao pagina={paginaConsolidado} totalPaginas={totalPaginasConsolidado} totalRegistros={consolidadoOrdenado.length} inicio={inicioConsolidado} fim={fimConsolidado} setPagina={setPaginaConsolidado} /></section>
          <details className="cartao ranking-intermediario"><summary>Consultar base intermediária do Ranking Integrado ({metadados.registros.rankingIntegrado} registros)</summary><p className="texto-apoio">A base intermediária permanece disponível para rastreabilidade e inclui os Subsídios técnicos de cada registro.</p><TabelaIntegrado registros={integradoPaginado} /><Paginacao pagina={paginaIntegrado} totalPaginas={totalPaginasIntegrado} totalRegistros={integradoOrdenado.length} inicio={inicioIntegrado} fim={fimIntegrado} setPagina={setPaginaIntegrado} /></details>
        </>
      )}

      {visao === 'Proposta Final' && (
        <>
          <section className="hero-proposta">
            <div><span className="etiqueta etiqueta--final">PROPOSTA FINAL PÓS-GT</span><h2>29 ativos e passivos selecionados para a versão final</h2><p>{texto(finalResumo.nota)}</p></div>
            <div className="hero-proposta-numero"><strong>{texto(finalResumo.total)}</strong><span>itens finais</span></div>
          </section>

          <Filtros area={area} setArea={setArea} tipo={tipo} setTipo={setTipo} busca={busca} setBusca={setBusca} />
          <section className="cartao cartao--final lista-final-prioritaria">
            <div className="cartao-titulo"><span className="barra-titulo barra-titulo--vermelho" /><div><h2>Lista final pós-GT</h2><p>Rastreabilidade dos itens finais, com vínculo aos desafios, indicadores, evidências e tratamento qualitativo.</p></div></div>
            <div className="ranking-controles"><div className="ranking-resumo"><span><strong>{finalOrdenado.length}</strong> item(ns) no recorte</span><small>Ordenação interativa pelas colunas da tabela.</small></div><div className="ranking-acoes"><button className="botao-exportar botao-exportar--final" type="button" onClick={() => baixarCsv(finalOrdenado,'proposta_final_maranhao_2050',colunasCsv)}>↓ Exportar Proposta Final</button><label>Exibir<select value={itensPorPagina} onChange={(e)=>setItensPorPagina(Number(e.target.value))}><option value={10}>10</option><option value={15}>15</option><option value={25}>25</option><option value={50}>50</option></select> por página</label></div></div>
            <TabelaPriorizacao registros={finalPaginado} campoOrdenacao={campoFinal} direcao={direcaoFinal} aoOrdenar={(c)=>alternarOrdenacao(c,'final')} />
            <Paginacao pagina={paginaFinal} totalPaginas={totalPaginasFinal} totalRegistros={finalOrdenado.length} inicio={inicioFinal} fim={fimFinal} setPagina={setPaginaFinal} />
          </section>

          <section className="titulo-secao titulo-secao--interno analises-proposta-final">
            <div><span className="etiqueta">ANÁLISES</span><h2>Leituras da composição da Proposta Final</h2></div>
            <p>Os quadros e gráficos abaixo sintetizam a composição do conjunto final sem substituir a lista prioritária acima.</p>
          </section>

          <section className="cards cards--cinco">
            <article className="card-kpi card-kpi--turquesa"><span>Ativos estratégicos</span><strong>{texto(finalResumo.ativos)}</strong></article>
            <article className="card-kpi card-kpi--vermelho"><span>Passivos críticos</span><strong>{texto(finalResumo.passivos)}</strong></article>
            <article className="card-kpi card-kpi--destaque"><span>Itens da versão final</span><strong>{texto(finalResumo.total)}</strong></article>
            <article className="card-kpi card-kpi--amarelo"><span>Prioridade alta ou muito alta</span><strong>{texto(finalResumo.altaOuMuitoAlta)}</strong></article>
            <article className="card-kpi card-kpi--laranja"><span>Prioridade média</span><strong>{propostaFinal.filter((r) => normalizar(prioridadePublica(r.Prioridade)) === 'media').length}</strong></article>
          </section>

          <section className="leituras-executivas"><article><strong>{Math.round(numero(finalResumo.passivos)/Math.max(1,numero(finalResumo.total))*100)}%</strong><span>do conjunto final é composto por passivos, refletindo o foco de superação de gargalos estruturais.</span></article><article><strong>{maiorAreaFinal?.total ?? 0}</strong><span>itens estão em {maiorAreaFinal?.area.nome}, maior concentração da proposta final.</span></article><article><strong>{socialPassivos}</strong><span>passivos e {socialAtivos} ativos estão em Sociedade Saudável, Segura e Justa.</span></article></section>

          <section className="grade-graficos"><article className="cartao"><div className="cartao-titulo"><span className="barra-titulo barra-titulo--vermelho" /><div><h2>Ativos e passivos por Área de Resultado</h2><p>Distribuição dos 29 itens da Proposta Final com o nome completo das cinco Áreas de Resultado.</p></div></div><ReactECharts option={graficoFinalAreas} style={{height:420}} /></article><article className="cartao"><div className="cartao-titulo"><span className="barra-titulo barra-titulo--turquesa" /><div><h2>Leitura da composição final</h2><p>O conjunto combina capacidades a potencializar e fragilidades prioritárias a superar.</p></div></div><div className="composicao-final"><div><strong>{texto(finalResumo.ativos)}</strong><span>Ativos</span></div><div><strong>{texto(finalResumo.passivos)}</strong><span>Passivos</span></div></div><p className="texto-apoio">A Proposta Final é o resultado da rodada de trabalho do GT e constitui a etapa principal do painel.</p></article></section>

          <section className="grade-graficos"><article className="cartao"><div className="cartao-titulo"><span className="barra-titulo barra-titulo--turquesa" /><div><h2>Ativos de maior score-base</h2><p>Sete ativos com maior score-base na versão final.</p></div></div><ReactECharts option={graficoTopFinal(topAtivosFinal,'Ativos')} style={{height:380}} /></article><article className="cartao"><div className="cartao-titulo"><span className="barra-titulo barra-titulo--vermelho" /><div><h2>Passivos de maior score-base</h2><p>Sete passivos com maior score-base na versão final.</p></div></div><ReactECharts option={graficoTopFinal(topPassivosFinal,'Passivos')} style={{height:380}} /></article></section>
          <aside className="aviso aviso--final"><strong>Leitura principal do painel.</strong> A Proposta Final é a etapa de síntese pós-GT. Os rankings anteriores permanecem como bases de rastreabilidade da construção metodológica.</aside>
        </>
      )}

      <footer className="rodape"><span>Plano Maranhão 2050</span><span>Revisão de Ativos e Passivos · sistematização, escuta, consolidação e Proposta Final</span></footer>
    </main>
  )
}

export default App
