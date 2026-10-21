import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import './index.css'

type Registro = Record<string, unknown>

type Metadados = {
  titulo: string
  geradoEm: string
  fonte: string
  registros: Record<string, number>
  distribuicao: {
    porTipo: Record<string, number>
    porArea: Record<string, number>
    porPrioridade: Record<string, number>
  }
  metodologia: {
    adesaoDesafiosEMaturidade: number
    votacaoEscuta: number
    qualidadeDaInformacao: number
    factibilidadeFiscalOrientativa: number
    nota: string
  }
}

type ReferenciasPlano = {
  titulo: string
  nota: string
  desafios: Registro[]
  indicadores: Registro[]
}

type FiltrosDaAba = {
  area: string
  tipo: string
  origem: string
  busca: string
}

type Visao = 'Proposta Final' | 'Síntese' | 'Escuta Técnica' | 'Ranking Consolidado' | 'Referências do Plano'

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
  {
    chave: 'educa',
    nome: 'Educação, Identidade e Cultura Transformadoras e Estruturantes',
    nomeCurto: 'Educação, identidade e cultura',
    cor: '#F4C034',
    ordem: 1,
  },
  {
    chave: 'econom',
    nome: 'Economia Próspera e Inclusiva',
    nomeCurto: 'Economia',
    cor: '#E0382C',
    ordem: 2,
  },
  {
    chave: 'meio ambiente',
    nome: 'Meio Ambiente Valorizado e Resiliente',
    nomeCurto: 'Meio ambiente',
    cor: '#50C08C',
    ordem: 3,
  },
  {
    chave: 'sociedade',
    nome: 'Sociedade Saudável, Segura e Justa',
    nomeCurto: 'Sociedade',
    cor: '#F4A840',
    ordem: 4,
  },
  {
    chave: 'governan',
    nome: 'Governança Efetiva, Conectada e Inovadora',
    nomeCurto: 'Governança',
    cor: '#2CA4B0',
    ordem: 5,
  },
]

const VISOES: Visao[] = [
  'Proposta Final',
  'Síntese',
  'Escuta Técnica',
  'Ranking Consolidado',
  'Referências do Plano',
]

const ETAPAS_METODOLOGIA = [
  ['01', 'Mobilização institucional', 'Recebimento de documentos, diagnósticos, projetos, diretrizes e contribuições das entidades participantes.'],
  ['02', 'Leitura de evidências', 'Identificação de ativos, passivos, propostas e evidências relevantes em cada documento encaminhado.'],
  ['03', 'Classificação temática', 'Vinculação das contribuições às cinco Áreas de Resultado do Plano Maranhão 2050.'],
  ['04', 'Vínculo com o Plano', 'Associação lógica aos desafios e indicadores estratégicos que orientam a revisão de longo prazo bem como a conexão com as lacunas encontradas no Plano Maranhão 2050.'],
  ['05', 'Escuta técnica', 'Priorização pelos membros das Câmaras Técnicas e incorporação das informações qualitativas recebidas.'],
  ['06', 'Qualificação e viabilidade', 'Análise de robustez das evidências, aderência aos desafios e factibilidade fiscal orientativa.'],
  ['07', 'Consolidação no GT', 'Requalificação da lista, validação técnica e organização da Proposta Final de ativos e passivos.'],
] as const

function texto(valor: unknown) {
  return String(valor ?? '').trim()
}

function numero(valor: unknown) {
  if (typeof valor === 'number') return valor
  const convertido = Number(texto(valor).replace(',', '.'))
  return Number.isFinite(convertido) ? convertido : 0
}

function normalizar(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

function configArea(valor: unknown): AreaConfig {
  const valorNormalizado = normalizar(texto(valor))
  const encontrada = AREAS.find((item) => valorNormalizado.includes(normalizar(item.chave)))
  return encontrada ?? {
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

function chaveArea(valor: unknown) {
  return configArea(valor).chave
}

function correspondeArea(valor: unknown, filtro: string) {
  return filtro === 'Todas' || chaveArea(valor) === filtro
}

function percentual(parte: number, total: number) {
  return total > 0 ? (parte / total) * 100 : 0
}

function corComOpacidade(hex: string, opacidade: number) {
  const valor = hex.replace('#', '')
  if (valor.length !== 6) return hex

  const vermelho = Number.parseInt(valor.slice(0, 2), 16)
  const verde = Number.parseInt(valor.slice(2, 4), 16)
  const azul = Number.parseInt(valor.slice(4, 6), 16)
  return `rgba(${vermelho}, ${verde}, ${azul}, ${opacidade})`
}

function ePrioridadeAlta(valor: unknown) {
  const prioridade = normalizar(texto(valor))
  return prioridade.startsWith('alta') || prioridade.includes('muito alta')
}

function prioridadeExibida(valor: unknown) {
  return texto(valor).replace(/\s*\(validar\)\s*/gi, '').trim()
}

function quebraNomeAreaParaGrafico(valor: string) {
  return valor
    .replace('Educação, Identidade e Cultura Transformadoras e Estruturantes', 'Educação, Identidade e Cultura\nTransformadoras e Estruturantes')
    .replace('Economia Próspera e Inclusiva', 'Economia Próspera\ne Inclusiva')
    .replace('Meio Ambiente Valorizado e Resiliente', 'Meio Ambiente\nValorizado e Resiliente')
    .replace('Sociedade Saudável, Segura e Justa', 'Sociedade Saudável,\nSegura e Justa')
    .replace('Governança Efetiva, Conectada e Inovadora', 'Governança Efetiva,\nConectada e Inovadora')
}

function arquivoPublico(nome: string) {
  return `${import.meta.env.BASE_URL}data/${nome}`
}

async function carregarJson<T>(nome: string): Promise<T> {
  const resposta = await fetch(arquivoPublico(nome))
  if (!resposta.ok) throw new Error(`Não foi possível carregar ${nome}.`)
  return resposta.json() as Promise<T>
}

function contar(registros: Registro[], campo: string) {
  return registros.reduce<Record<string, number>>((acumulado, registro) => {
    const chave = texto(registro[campo]) || 'Não informado'
    acumulado[chave] = (acumulado[chave] ?? 0) + 1
    return acumulado
  }, {})
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

function valorDaMetricaDaEscuta(registro: Registro, metrica: string) {
  const correspondencia = texto(registro['Prioridade na escuta']).match(
    new RegExp(`${metrica}:\\s*([\\d,.]+)`, 'i'),
  )
  return correspondencia ? numero(correspondencia[1]) : 0
}

function rotuloFactibilidade(valor: string) {
  const normalizado = valor.toLocaleLowerCase('pt-BR')
  if (normalizado.includes('alta')) return 'selo selo--alta'
  if (normalizado.includes('baixa')) return 'selo selo--baixa'
  return 'selo selo--media'
}

type CampoOrdenacao =
  | 'Posição'
  | 'Tema, ativo ou passivo'
  | 'Área de resultado'
  | 'Tipo'
  | 'Origem'
  | 'Score final (0–100)'
  | 'Prioridade'
  | 'Grau de factibilidade'

type DirecaoOrdenacao = 'asc' | 'desc'
type ItemPaginacao = number | '…'

const COLUNAS_EXPORTACAO: Array<{ rotulo: string; campo: string }> = [
  { rotulo: 'Posição', campo: 'Posição' },
  { rotulo: 'Tema / ativo / passivo', campo: 'Tema, ativo ou passivo' },
  { rotulo: 'Área de Resultado', campo: 'Área de resultado' },
  { rotulo: 'Tipo', campo: 'Tipo' },
  { rotulo: 'Origem', campo: 'Origem' },
  { rotulo: 'Score final (0–100)', campo: 'Score final (0–100)' },
  { rotulo: 'Prioridade', campo: 'Prioridade' },
  { rotulo: 'Factibilidade', campo: 'Grau de factibilidade' },
  { rotulo: 'Desafio(s) do Plano', campo: 'Desafio(s) do Plano' },
  { rotulo: 'Indicador do Plano associado', campo: 'Indicador do Plano associado' },
  { rotulo: 'Fonte e localização', campo: 'Fonte e localização' },
]

function valorParaOrdenacao(registro: Registro, campo: CampoOrdenacao) {
  if (campo === 'Posição' || campo === 'Score final (0–100)') {
    return numero(registro[campo])
  }

  if (campo === 'Área de resultado') {
    return nomeArea(registro[campo])
  }

  return texto(registro[campo])
}

function compararRegistros(
  a: Registro,
  b: Registro,
  campo: CampoOrdenacao,
  direcao: DirecaoOrdenacao,
) {
  const valorA = valorParaOrdenacao(a, campo)
  const valorB = valorParaOrdenacao(b, campo)

  let resultado = 0

  if (typeof valorA === 'number' && typeof valorB === 'number') {
    resultado = valorA - valorB
  } else {
    resultado = String(valorA).localeCompare(String(valorB), 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    })
  }

  return direcao === 'asc' ? resultado : -resultado
}

function paginasVisiveis(atual: number, total: number): ItemPaginacao[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, indice) => indice + 1)
  }

  let inicio = Math.max(2, atual - 1)
  let fim = Math.min(total - 1, atual + 1)

  if (atual <= 4) {
    inicio = 2
    fim = 5
  }

  if (atual >= total - 3) {
    inicio = total - 4
    fim = total - 1
  }

  const itens: ItemPaginacao[] = [1]

  if (inicio > 2) itens.push('…')

  for (let pagina = inicio; pagina <= fim; pagina += 1) {
    itens.push(pagina)
  }

  if (fim < total - 1) itens.push('…')

  itens.push(total)
  return itens
}

function valorExportacao(registro: Registro, campo: string) {
  if (campo === 'Área de resultado') return nomeArea(registro[campo])
  if (campo === 'Score final (0–100)') return numero(registro[campo]).toFixed(1)
  return texto(registro[campo])
}

function escaparCsv(valor: string) {
  return `"${valor.replace(/"/g, '""')}"`
}

function baixarCsv(registros: Registro[]) {
  const cabecalho = COLUNAS_EXPORTACAO
    .map((coluna) => escaparCsv(coluna.rotulo))
    .join(';')

  const linhas = registros.map((registro) =>
    COLUNAS_EXPORTACAO
      .map((coluna) => escaparCsv(valorExportacao(registro, coluna.campo)))
      .join(';'),
  )

  const conteudo = `\uFEFF${[cabecalho, ...linhas].join('\r\n')}`
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const data = new Date().toISOString().slice(0, 10)

  link.href = url
  link.download = `ranking_maranhao_2050_${data}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function classeTipo(valor: unknown) {
  const tipo = normalizar(texto(valor))
  if (tipo.includes('ativo')) return 'tipo tipo--ativo'
  if (tipo.includes('passivo')) return 'tipo tipo--passivo'
  if (tipo.includes('proposta')) return 'tipo tipo--proposta'
  return 'tipo'
}

function TabelaRanking({
  registros,
  campoOrdenacao,
  direcaoOrdenacao,
  aoOrdenar,
  rotuloScore = 'Score',
  mostrarConvergenciaDeEvidencias = false,
  normalizarPrioridade = false,
}: {
  registros: Registro[]
  campoOrdenacao?: CampoOrdenacao
  direcaoOrdenacao?: DirecaoOrdenacao
  aoOrdenar?: (campo: CampoOrdenacao) => void
  rotuloScore?: string
  mostrarConvergenciaDeEvidencias?: boolean
  normalizarPrioridade?: boolean
}) {
  function cabecalho(rotulo: string, campo: CampoOrdenacao) {
    if (!aoOrdenar) return <th>{rotulo}</th>

    const ativo = campoOrdenacao === campo
    const ariaSort = ativo
      ? (direcaoOrdenacao === 'asc' ? 'ascending' : 'descending')
      : 'none'

    return (
      <th aria-sort={ariaSort}>
        <button
          type="button"
          className={`cabecalho-ordenavel ${ativo ? 'ativo' : ''}`}
          onClick={() => aoOrdenar(campo)}
          title={`Ordenar por ${rotulo}`}
        >
          <span>{rotulo}</span>
          <span className="icone-ordenacao" aria-hidden="true">
            {ativo ? (direcaoOrdenacao === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </button>
      </th>
    )
  }

  return (
    <div className="tabela-wrap">
      <table>
        <thead>
          <tr>
            {cabecalho('Pos.', 'Posição')}
            {cabecalho('Tema / ativo / passivo', 'Tema, ativo ou passivo')}
            {cabecalho('Área de Resultado', 'Área de resultado')}
            {cabecalho('Tipo', 'Tipo')}
            {!mostrarConvergenciaDeEvidencias && cabecalho('Origem', 'Origem')}
            {cabecalho(rotuloScore, 'Score final (0–100)')}
            {cabecalho('Prioridade', 'Prioridade')}
            {cabecalho('Factibilidade', 'Grau de factibilidade')}
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => (
            <tr key={`${texto(registro['Posição'])}-${texto(registro['Tema, ativo ou passivo'])}`}>
              <td className="posicao">{texto(registro['Posição'])}</td>
              <td className="tema">
                <strong>{texto(registro['Tema, ativo ou passivo'])}</strong>
                <details>
                  <summary>Ver evidência e vínculo</summary>
                  <p><b>Desafio:</b> {texto(registro['Desafio(s) do Plano']) || 'Não informado'}</p>
                  <p><b>Indicador:</b> {texto(registro['Indicador do Plano associado']) || 'Não informado'}</p>
                  <p><b>Fonte:</b> {texto(registro['Fonte e localização']) || 'Não informado'}</p>
                  {texto(registro['Tratamento qualitativo']) && (
                    <p><b>Tratamento qualitativo:</b> {texto(registro['Tratamento qualitativo'])}</p>
                  )}
                  {texto(registro['Observações e comentários consolidados']) && (
                    <p><b>Observações e comentários:</b> {texto(registro['Observações e comentários consolidados'])}</p>
                  )}
                </details>
                {mostrarConvergenciaDeEvidencias && texto(registro.Origem) && (
                  <details className="evidencias-convergentes">
                    <summary title="Contribuições, fontes e registros integrados que reforçam este item.">
                      Ver convergência de evidências
                    </summary>
                    <p>
                      <b>Contribuições e evidências integradas:</b>{' '}
                      {texto(registro.Origem)}
                    </p>
                  </details>
                )}
              </td>
              <td>
                <span
                  className="area"
                  style={{ backgroundColor: corArea(registro['Área de resultado']) }}
                  title={nomeArea(registro['Área de resultado'])}
                >
                  {nomeArea(registro['Área de resultado'])}
                </span>
              </td>
              <td><span className={classeTipo(registro.Tipo)}>{texto(registro.Tipo)}</span></td>
              {!mostrarConvergenciaDeEvidencias && <td>{texto(registro.Origem)}</td>}
              <td><span className="score">{numero(registro['Score final (0–100)']).toFixed(1)}</span></td>
              <td>{normalizarPrioridade ? prioridadeExibida(registro.Prioridade) : texto(registro.Prioridade)}</td>
              <td>
                <span className={rotuloFactibilidade(texto(registro['Grau de factibilidade']))}>
                  {texto(registro['Grau de factibilidade'])}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {registros.length === 0 && (
        <div className="tabela-vazia">
          Nenhum registro encontrado para os filtros selecionados.
        </div>
      )}
    </div>
  )
}

function TabelaEscuta({
  registros,
  tipo,
}: {
  registros: Registro[]
  tipo: 'Ativo' | 'Passivo'
}) {
  const rotuloMetrica = tipo === 'Ativo' ? 'Potencial médio' : 'Gravidade média'
  const respondentes = respondentesDaEscuta(registros)

  return (
    <div className="tabela-wrap tabela-escuta">
      <table>
        <thead>
          <tr>
            <th>Pos.</th>
            <th>{tipo}</th>
            <th>Área de Resultado</th>
            <th>Eleições</th>
            <th>{rotuloMetrica}</th>
            <th>Urgência média</th>
            <th>Desafio do Plano</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((registro, indice) => {
            const selecoes = selecoesDaEscuta(registro)
            const percentual = percentualDaEscuta(registro)

            return (
              <tr key={`${tipo}-${texto(registro['Tema, ativo ou passivo identificado'])}`}>
                <td className="posicao">{indice + 1}</td>
                <td className="tema">
                  <strong>{texto(registro['Tema, ativo ou passivo identificado'])}</strong>
                  <details>
                    <summary>Ver evidência e vínculo</summary>
                    <p><b>Evidência:</b> {texto(registro['Evidência da escuta']) || 'Não informado'}</p>
                    <p><b>Indicador:</b> {texto(registro['Indicador do Plano associado']) || 'Não informado'}</p>
                    <p><b>Fonte:</b> {texto(registro['Fonte e localização']) || 'Não informado'}</p>
                  </details>
                </td>
                <td>
                  <span
                    className="area"
                    style={{ backgroundColor: corArea(registro['Área de resultado']) }}
                    title={nomeArea(registro['Área de resultado'])}
                  >
                    {nomeArea(registro['Área de resultado'])}
                  </span>
                </td>
                <td className="dados-escuta">
                  <span className="score">{selecoes}/{respondentes || '–'}</span>
                  <small>{percentual.toFixed(0)}% dos participantes</small>
                </td>
                <td>{valorDaMetricaDaEscuta(registro, rotuloMetrica).toFixed(2)}</td>
                <td>{valorDaMetricaDaEscuta(registro, 'Urgência média').toFixed(2)}</td>
                <td>{texto(registro['Desafio do Plano relacionado']) || 'Não informado'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {registros.length === 0 && (
        <div className="tabela-vazia">
          Nenhum {tipo.toLocaleLowerCase('pt-BR')} priorizado para os filtros selecionados.
        </div>
      )}
    </div>
  )
}

function MapaDestaques({
  tipo,
  registros,
}: {
  tipo: 'Ativo' | 'Passivo'
  registros: Registro[]
}) {
  const destaques = registros.slice(0, 7)
  const rotuloTipo = tipo === 'Ativo' ? 'Ativos e potencialidades' : 'Passivos e fragilidades'
  const corCentral = tipo === 'Ativo' ? CORES_IDENTIDADE.turquesa : CORES_IDENTIDADE.vermelho
  const gradiente = destaques.length === 0
    ? '#eef1f2'
    : `conic-gradient(from -90deg, ${destaques.map((registro, indice) => {
      const inicio = (indice / destaques.length) * 360
      const fim = ((indice + 1) / destaques.length) * 360
      const cor = corArea(registro['Área de resultado'])
      return `${cor} ${inicio}deg ${Math.max(inicio, fim - 1.5)}deg, #ffffff ${Math.max(inicio, fim - 1.5)}deg ${fim}deg`
    }).join(', ')})`

  return (
    <article className={`mapa-destaques mapa-destaques--${tipo.toLocaleLowerCase('pt-BR')}`}>
      <div className="mapa-destaques__visual" aria-label={`${rotuloTipo}: principais destaques da lista final`}>
        <div className="mapa-destaques__anel" style={{ background: gradiente }}>
          {destaques.map((registro, indice) => {
            const angulo = ((indice / destaques.length) * 360) - 90
            return (
              <span
                className="mapa-destaques__numero"
                key={`${tipo}-${texto(registro['Tema, ativo ou passivo'])}`}
                style={{ transform: `translate(-50%, -50%) rotate(${angulo}deg) translateY(-126px) rotate(${-angulo}deg)` }}
                title={texto(registro['Tema, ativo ou passivo'])}
              >
                {indice + 1}
              </span>
            )
          })}
          <div className="mapa-destaques__centro" style={{ backgroundColor: corCentral }}>
            <span>{rotuloTipo}</span>
            <strong>{registros.length}</strong>
            <small>itens finais</small>
          </div>
        </div>
      </div>

      <ol className="mapa-destaques__lista">
        {destaques.map((registro, indice) => (
          <li key={`${tipo}-lista-${texto(registro['Tema, ativo ou passivo'])}`}>
            <span className="mapa-destaques__ordem">{indice + 1}</span>
            <div>
              <strong>{texto(registro['Tema, ativo ou passivo'])}</strong>
              <small>
                {configArea(registro['Área de resultado']).nome}
                {' · Score-base '}{numero(registro['Score final (0–100)']).toFixed(1)}
              </small>
            </div>
          </li>
        ))}
      </ol>

      <p className="mapa-destaques__nota">Destaques ordenados pelo score-base. A lista final completa está apresentada abaixo.</p>
    </article>
  )
}

function App() {
  const [ranking, setRanking] = useState<Registro[]>([])
  const [consolidadoQualitativo, setConsolidadoQualitativo] = useState<Registro[]>([])
  const [escuta, setEscuta] = useState<Registro[]>([])
  const [lacunas, setLacunas] = useState<Registro[]>([])
  const [referenciasPlano, setReferenciasPlano] = useState<ReferenciasPlano | null>(null)
  const [metadados, setMetadados] = useState<Metadados | null>(null)
  const [visao, setVisao] = useState<Visao>('Proposta Final')
  const [filtrosProposta, setFiltrosProposta] = useState<FiltrosDaAba>({
    area: 'Todas', tipo: 'Todos', origem: 'Todas', busca: '',
  })
  const [filtrosEscuta, setFiltrosEscuta] = useState<FiltrosDaAba>({
    area: 'Todas', tipo: 'Todos', origem: 'Todas', busca: '',
  })
  const [filtrosRanking, setFiltrosRanking] = useState<FiltrosDaAba>({
    area: 'Todas', tipo: 'Todos', origem: 'Todas', busca: '',
  })
  const [erro, setErro] = useState('')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(25)
  const [campoOrdenacao, setCampoOrdenacao] = useState<CampoOrdenacao>('Score final (0–100)')
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<DirecaoOrdenacao>('desc')

  useEffect(() => {
    Promise.all([
      carregarJson<Registro[]>('ranking-integrado.json'),
      carregarJson<Registro[]>('ranking-consolidado-ap.json'),
      carregarJson<Registro[]>('escuta-tecnica.json'),
      carregarJson<Registro[]>('lacunas-indicadores.json'),
      carregarJson<ReferenciasPlano>('referencias-plano.json'),
      carregarJson<Metadados>('metadados.json'),
    ])
      .then(([dadosRanking, dadosConsolidadoQualitativo, dadosEscuta, dadosLacunas, dadosReferenciasPlano, dadosMetadados]) => {
        setRanking(dadosRanking)
        setConsolidadoQualitativo(dadosConsolidadoQualitativo)
        setEscuta(dadosEscuta)
        setLacunas(dadosLacunas)
        setReferenciasPlano(dadosReferenciasPlano)
        setMetadados(dadosMetadados)
      })
      .catch((causa: Error) => setErro(causa.message))
  }, [])

  const areasRanking = useMemo(
    () => AREAS.filter((config) => ranking.some((registro) =>
      chaveArea(registro['Área de resultado']) === config.chave,
    )),
    [ranking],
  )

  const areasProposta = useMemo(
    () => AREAS.filter((config) => consolidadoQualitativo.some((registro) =>
      chaveArea(registro['Área de resultado']) === config.chave,
    )),
    [consolidadoQualitativo],
  )

  const areasEscuta = useMemo(
    () => AREAS.filter((config) => escuta.some((registro) =>
      chaveArea(registro['Área de resultado']) === config.chave,
    )),
    [escuta],
  )

  const tiposRanking = useMemo(
    () => Array.from(new Set(ranking.map((registro) => texto(registro.Tipo)))).filter(Boolean).sort(),
    [ranking],
  )

  const tiposProposta = useMemo(
    () => Array.from(new Set(consolidadoQualitativo.map((registro) => texto(registro.Tipo))))
      .filter((item) => item && item !== 'Proposta')
      .sort(),
    [consolidadoQualitativo],
  )

  const tiposEscuta = useMemo(
    () => Array.from(new Set(escuta.map((registro) => texto(registro.Tipo))))
      .filter((item) => item && item !== 'Proposta')
      .sort(),
    [escuta],
  )

  const origensRanking = useMemo(
    () => Array.from(new Set(ranking.map((registro) => texto(registro.Origem)))).filter(Boolean).sort(),
    [ranking],
  )

  const origensProposta = useMemo(
    () => Array.from(new Set(consolidadoQualitativo.map((registro) => texto(registro.Origem))))
      .filter(Boolean)
      .sort(),
    [consolidadoQualitativo],
  )

  const coberturaPorOrigem = useMemo(() => Object.entries(contar(ranking, 'Origem'))
    .sort(([origemA, totalA], [origemB, totalB]) =>
      Number(totalB) - Number(totalA) || origemA.localeCompare(origemB, 'pt-BR'),
    ), [ranking])

  const entidadesInstitucionais = useMemo(
    () => coberturaPorOrigem.filter(([origem]) => origem !== 'Escuta Técnica'),
    [coberturaPorOrigem],
  )

  const filtrados = useMemo(() => ranking
    .filter((registro) => correspondeArea(registro['Área de resultado'], filtrosRanking.area))
    .filter((registro) => filtrosRanking.tipo === 'Todos' || texto(registro.Tipo) === filtrosRanking.tipo)
    .filter((registro) => filtrosRanking.origem === 'Todas' || texto(registro.Origem) === filtrosRanking.origem)
    .filter((registro) => texto(registro['Tema, ativo ou passivo']).toLocaleLowerCase('pt-BR').includes(filtrosRanking.busca.toLocaleLowerCase('pt-BR')))
    .sort((a, b) => numero(b['Score final (0–100)']) - numero(a['Score final (0–100)'])),
    [ranking, filtrosRanking],
  )

  const rankingOrdenado = useMemo(
    () => [...filtrados].sort((a, b) =>
      compararRegistros(a, b, campoOrdenacao, direcaoOrdenacao),
    ),
    [filtrados, campoOrdenacao, direcaoOrdenacao],
  )

  const totalRegistrosRanking = rankingOrdenado.length
  const totalPaginasRanking = Math.max(1, Math.ceil(totalRegistrosRanking / itensPorPagina))
  const inicioPagina = (paginaAtual - 1) * itensPorPagina
  const fimPagina = inicioPagina + itensPorPagina
  const rankingPaginado = rankingOrdenado.slice(inicioPagina, fimPagina)
  const paginasRanking = paginasVisiveis(paginaAtual, totalPaginasRanking)

  const porAreaSintese = ranking.reduce<Record<string, number>>((acumulado, registro) => {
    const nome = nomeArea(registro['Área de resultado'])
    acumulado[nome] = (acumulado[nome] ?? 0) + 1
    return acumulado
  }, {})
  const porTipoSintese = contar(ranking, 'Tipo')

  const consolidadoFiltrado = useMemo(() => consolidadoQualitativo
    .filter((registro) => correspondeArea(registro['Área de resultado'], filtrosProposta.area))
    .filter((registro) => filtrosProposta.tipo === 'Todos' || texto(registro.Tipo) === filtrosProposta.tipo)
    .filter((registro) => filtrosProposta.origem === 'Todas' || texto(registro.Origem).includes(filtrosProposta.origem))
    .filter((registro) => normalizar(texto(registro['Tema, ativo ou passivo'])).includes(normalizar(filtrosProposta.busca)))
    .sort((a, b) => numero(b['Score final (0–100)']) - numero(a['Score final (0–100)'])),
  [consolidadoQualitativo, filtrosProposta])

  const ativosConsolidados = useMemo(
    () => consolidadoFiltrado.filter((registro) => texto(registro.Tipo) === 'Ativo'),
    [consolidadoFiltrado],
  )

  const passivosConsolidados = useMemo(
    () => consolidadoFiltrado.filter((registro) => texto(registro.Tipo) === 'Passivo'),
    [consolidadoFiltrado],
  )

  const distribuicaoFinalPorArea = useMemo(() => AREAS.map((config) => {
    const registrosDaArea = consolidadoFiltrado.filter((registro) =>
      configArea(registro['Área de resultado']).chave === config.chave,
    )
    const ativos = registrosDaArea.filter((registro) => texto(registro.Tipo) === 'Ativo').length
    const passivos = registrosDaArea.filter((registro) => texto(registro.Tipo) === 'Passivo').length

    return {
      ...config,
      ativos,
      passivos,
      total: ativos + passivos,
    }
  }).filter((item) => item.total > 0), [consolidadoFiltrado])

  const totalPrioridadeAltaFinal = useMemo(
    () => consolidadoFiltrado.filter((registro) => ePrioridadeAlta(registro.Prioridade)).length,
    [consolidadoFiltrado],
  )

  const scoreMedioFinal = useMemo(() => {
    if (consolidadoFiltrado.length === 0) return 0
    return consolidadoFiltrado.reduce(
      (soma, registro) => soma + numero(registro['Score final (0–100)']),
      0,
    ) / consolidadoFiltrado.length
  }, [consolidadoFiltrado])

  const areaMaisRepresentadaFinal = useMemo(
    () => [...distribuicaoFinalPorArea].sort((a, b) => b.total - a.total)[0],
    [distribuicaoFinalPorArea],
  )

  const recorteSociedadeFinal = useMemo(
    () => distribuicaoFinalPorArea.find((item) => item.chave === 'sociedade'),
    [distribuicaoFinalPorArea],
  )

  const escutaFiltrada = useMemo(() => escuta
    .filter((registro) => correspondeArea(registro['Área de resultado'], filtrosEscuta.area))
    .filter((registro) => filtrosEscuta.tipo === 'Todos' || texto(registro.Tipo) === filtrosEscuta.tipo)
    .filter((registro) => texto(registro['Tema, ativo ou passivo identificado']).toLocaleLowerCase('pt-BR').includes(filtrosEscuta.busca.toLocaleLowerCase('pt-BR')))
    .filter((registro) => selecoesDaEscuta(registro) > 0)
    .sort((a, b) => selecoesDaEscuta(b) - selecoesDaEscuta(a)), [escuta, filtrosEscuta])

  const ativosPriorizadosEscuta = useMemo(
    () => escutaFiltrada.filter((registro) => texto(registro.Tipo) === 'Ativo'),
    [escutaFiltrada],
  )

  const passivosPriorizadosEscuta = useMemo(
    () => escutaFiltrada.filter((registro) => texto(registro.Tipo) === 'Passivo'),
    [escutaFiltrada],
  )

  const participantesEscuta = useMemo(() => respondentesDaEscuta(escuta), [escuta])
  const totalPriorizadosEscuta = ativosPriorizadosEscuta.length + passivosPriorizadosEscuta.length

  useEffect(() => {
    setPaginaAtual(1)
  }, [filtrosRanking, itensPorPagina])

  useEffect(() => {
    if (paginaAtual > totalPaginasRanking) {
      setPaginaAtual(totalPaginasRanking)
    }
  }, [paginaAtual, totalPaginasRanking])

  function ordenarRanking(campo: CampoOrdenacao) {
    setPaginaAtual(1)

    if (campo === campoOrdenacao) {
      setDirecaoOrdenacao((direcao) => direcao === 'asc' ? 'desc' : 'asc')
      return
    }

    setCampoOrdenacao(campo)
    setDirecaoOrdenacao(campo === 'Score final (0–100)' ? 'desc' : 'asc')
  }

  function atualizarFiltroDaAba(campo: keyof FiltrosDaAba, valor: string) {
    const atualizar = (definir: Dispatch<SetStateAction<FiltrosDaAba>>) => {
      definir((filtrosAtuais) => ({ ...filtrosAtuais, [campo]: valor }))
    }

    if (visao === 'Proposta Final') {
      atualizar(setFiltrosProposta)
      return
    }

    if (visao === 'Escuta Técnica') {
      atualizar(setFiltrosEscuta)
      return
    }

    if (visao === 'Ranking Consolidado') atualizar(setFiltrosRanking)
  }

  const dadosArea = Object.keys(porAreaSintese)
    .sort((a, b) => configArea(a).ordem - configArea(b).ordem)

  const graficoArea: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: { left: 12, right: 28, top: 22, bottom: 36, containLabel: true },
    xAxis: {
      type: 'value',
      name: 'Número de registros',
      nameLocation: 'middle',
      nameGap: 28,
      minInterval: 1,
    },
    yAxis: {
      type: 'category',
      data: dadosArea.map((chave) => quebraNomeAreaParaGrafico(configArea(chave).nome)),
      axisLabel: { width: 210, overflow: 'break', lineHeight: 15 },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 30,
      data: dadosArea.map((chave) => ({
        value: porAreaSintese[chave],
        itemStyle: {
          color: corArea(chave),
          borderRadius: [0, 8, 8, 0],
        },
      })),
    }],
  }

  const graficoTipo: EChartsOption = {
    color: [
      CORES_IDENTIDADE.turquesa,
      CORES_IDENTIDADE.vermelho,
      CORES_IDENTIDADE.amarelo,
      CORES_IDENTIDADE.laranja,
      CORES_IDENTIDADE.verde,
    ],
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['52%', '76%'],
      label: { formatter: '{b}: {c}' },
      data: Object.entries(porTipoSintese).map(([name, value]) => ({ name, value })),
    }],
  }

  const graficoCoberturaInstitucional: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 12, right: 30, top: 18, bottom: 36, containLabel: true },
    xAxis: {
      type: 'value',
      name: 'Número de contribuições',
      nameLocation: 'middle',
      nameGap: 28,
      minInterval: 1,
    },
    yAxis: {
      type: 'category',
      data: coberturaPorOrigem.map(([origem]) => origem),
      axisLabel: { width: 112, overflow: 'truncate' },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 22,
      data: coberturaPorOrigem.map(([origem, total]) => ({
        value: total,
        itemStyle: {
          color: origem === 'Escuta Técnica' ? CORES_IDENTIDADE.amarelo : CORES_IDENTIDADE.turquesa,
          borderRadius: [0, 8, 8, 0],
        },
      })),
    }],
  }

  function opcoesGraficoEscuta(registros: Registro[]): EChartsOption {
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 12, right: 20, top: 18, bottom: 106, containLabel: true },
      xAxis: {
        type: 'category',
        name: 'Temas mais eleitos',
        nameLocation: 'middle',
        nameGap: 80,
        data: registros.slice(0, 10).map((registro) => texto(registro['Tema, ativo ou passivo identificado'])),
        axisLabel: { rotate: 35, width: 108, overflow: 'truncate' },
      },
      yAxis: { type: 'value', minInterval: 1, name: 'Eleições' },
      series: [{
        name: 'Eleições',
        type: 'bar',
        barMaxWidth: 42,
        data: registros.slice(0, 10).map((registro) => ({
          value: selecoesDaEscuta(registro),
          itemStyle: {
            color: corArea(registro['Área de resultado']),
            borderRadius: [7, 7, 0, 0],
          },
        })),
      }],
    }
  }

  const graficoAtivosEscuta = opcoesGraficoEscuta(ativosPriorizadosEscuta)
  const graficoPassivosEscuta = opcoesGraficoEscuta(passivosPriorizadosEscuta)

  const graficoComposicaoFinal: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}<br/>{c} item(ns) · {d}%',
    },
    legend: {
      bottom: 0,
      data: ['Ativos', 'Passivos'],
      textStyle: { color: CORES_IDENTIDADE.cinza, fontWeight: 700 },
    },
    title: {
      text: String(consolidadoFiltrado.length),
      subtext: 'itens finais',
      left: '50%',
      top: '38%',
      textAlign: 'center',
      itemGap: 2,
      textStyle: { color: CORES_IDENTIDADE.cinza, fontSize: 31, fontWeight: 800 },
      subtextStyle: { color: '#7b8187', fontSize: 11, fontWeight: 700 },
    },
    series: [
      {
        name: 'Tipo',
        type: 'pie',
        radius: ['28%', '43%'],
        label: { show: false },
        labelLine: { show: false },
        data: [
          { name: 'Ativos', value: ativosConsolidados.length, itemStyle: { color: CORES_IDENTIDADE.turquesa } },
          { name: 'Passivos', value: passivosConsolidados.length, itemStyle: { color: CORES_IDENTIDADE.vermelho } },
        ],
      },
      {
        name: 'Área de resultado',
        type: 'pie',
        radius: ['52%', '76%'],
        minShowLabelAngle: 2,
        avoidLabelOverlap: true,
        label: {
          formatter: (parametro: unknown) => {
            const { name, value } = parametro as { name?: string; value?: unknown }
            const [nomeDaArea, tipoDoItem] = String(name ?? '').split(' · ')
            return `${quebraNomeAreaParaGrafico(nomeDaArea)}\n${tipoDoItem ?? ''}: ${String(value ?? '')}`
          },
          color: CORES_IDENTIDADE.cinza,
          fontSize: 9,
          fontWeight: 700,
          lineHeight: 13,
          width: 178,
          overflow: 'break',
        },
        labelLine: { length: 10, length2: 8 },
        data: distribuicaoFinalPorArea.flatMap((config) => [
          ...(config.ativos > 0
            ? [{
              name: `${config.nome} · Ativos`,
              value: config.ativos,
              itemStyle: { color: config.cor },
            }]
            : []),
          ...(config.passivos > 0
            ? [{
              name: `${config.nome} · Passivos`,
              value: config.passivos,
              itemStyle: { color: corComOpacidade(config.cor, 0.48) },
            }]
            : []),
        ]),
      },
    ],
  }

  if (erro) return <main className="estado"><h1>Painel indisponível</h1><p>{erro}</p></main>
  if (!metadados || !referenciasPlano) return <main className="estado"><p>Carregando dados da matriz…</p></main>

  const dataGeracao = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(metadados.geradoEm))
  const visaoComFiltros = visao === 'Proposta Final' || visao === 'Escuta Técnica' || visao === 'Ranking Consolidado'
  const filtrosDaVisao = visao === 'Proposta Final'
    ? filtrosProposta
    : visao === 'Escuta Técnica'
      ? filtrosEscuta
      : filtrosRanking
  const areasDaVisao = visao === 'Proposta Final'
    ? areasProposta
    : visao === 'Escuta Técnica'
      ? areasEscuta
      : areasRanking
  const tiposDaVisao = visao === 'Proposta Final'
    ? tiposProposta
    : visao === 'Escuta Técnica'
      ? tiposEscuta
      : tiposRanking
  const origensDaVisao = visao === 'Proposta Final'
    ? origensProposta
    : origensRanking
  const registrosDaVisao = visao === 'Proposta Final'
    ? consolidadoQualitativo
    : visao === 'Escuta Técnica'
      ? escuta
      : ranking
  const seloCabecalho = visao === 'Proposta Final'
    ? consolidadoQualitativo.length
    : metadados.registros.rankingIntegrado
  const rotuloSeloCabecalho = visao === 'Proposta Final'
    ? 'itens finais do GT'
    : 'registros integrados'

  return (
    <main className="painel">
      <header className="cabecalho">
        <div className="cabecalho-conteudo">
          <div className="marca">
            <span className="marca-simbolo" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <div>
              <p className="sobretitulo">PLANO MARANHÃO 2050</p>
              <h1>Painel de Priorização Estratégica</h1>
<p className="subtitulo">
  Ativos, passivos, evidências e referências para a revisão de longo prazo do Maranhão 2050.
</p>
            </div>
          </div>

          <div className="cabecalho-meta">
            <figure className="identidade-plano">
              <img
                src={`${import.meta.env.BASE_URL}identidade-plano-maranhao-2050.png`}
                alt="Identidade visual do Plano Estratégico de Longo Prazo Maranhão 2050"
              />
            </figure>
            <strong className="selo-base">{seloCabecalho}</strong>
            <span className="selo-legenda">{rotuloSeloCabecalho}</span>
          </div>
        </div>

        <div className="faixa-identidade" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </header>

      <nav className="navegacao" aria-label="Seções do painel">
        {VISOES.map((item) => (
          <button
            key={item}
            className={visao === item ? 'ativo' : ''}
            onClick={() => setVisao(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {visaoComFiltros && <>
        <section className="areas-resultado" aria-label={`Áreas de Resultado — ${visao}`}>
          {areasDaVisao.map((config) => {
            const selecionada = filtrosDaVisao.area === config.chave
            return (
              <button
                type="button"
                key={config.chave}
                className={`area-card ${selecionada ? 'selecionada' : ''}`}
                style={{ borderTopColor: config.cor }}
                onClick={() => atualizarFiltroDaAba('area', selecionada ? 'Todas' : config.chave)}
                title={`Filtrar ${visao} por ${config.nome}`}
              >
                <span className="area-card-cor" style={{ backgroundColor: config.cor }} />
                <strong>{config.nome}</strong>
                <span>
                  {registrosDaVisao.filter((registro) => chaveArea(registro['Área de resultado']) === config.chave).length}
                  {' '}{visao === 'Proposta Final' ? 'itens finais' : visao === 'Escuta Técnica' ? 'evidências' : 'registros'}
                </span>
              </button>
            )
          })}
        </section>

        <section className="filtros" aria-label={`Filtros da aba ${visao}`}>
          <label>
            Área de Resultado
            <select value={filtrosDaVisao.area} onChange={(evento) => atualizarFiltroDaAba('area', evento.target.value)}>
              <option value="Todas">Todas as áreas</option>
              {areasDaVisao.map((config) => <option key={config.chave} value={config.chave}>{config.nome}</option>)}
            </select>
          </label>

          <label>
            Tipo
            <select value={filtrosDaVisao.tipo} onChange={(evento) => atualizarFiltroDaAba('tipo', evento.target.value)}>
              <option value="Todos">Todos</option>
              {tiposDaVisao.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          {visao !== 'Escuta Técnica' && <label>
            Origem
            <select value={filtrosDaVisao.origem} onChange={(evento) => atualizarFiltroDaAba('origem', evento.target.value)}>
              <option value="Todas">Todas</option>
              {origensDaVisao.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>}

          <label className="busca">
            Buscar tema
            <input
              value={filtrosDaVisao.busca}
              onChange={(evento) => atualizarFiltroDaAba('busca', evento.target.value)}
              placeholder="Ex.: logística, saúde, turismo"
            />
          </label>
        </section>
      </>}

      {visao === 'Síntese' && <>
        <section className="titulo-secao">
          <div>
            <span className="etiqueta">SÍNTESE DO PROCESSO</span>
            <h2>Metodologia em sete fases</h2>
          </div>
          <p>Etapas que transformaram documentos institucionais e escuta técnica em uma proposta final rastreável.</p>
        </section>

        <section className="fases-metodologia">
          {ETAPAS_METODOLOGIA.map(([numeroDaFase, tituloDaFase, descricaoDaFase]) => (
            <article className="fase-metodologia" key={numeroDaFase}>
              <span>{numeroDaFase}</span>
              <div>
                <strong>{tituloDaFase}</strong>
                <p>{descricaoDaFase}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="titulo-secao">
          <div>
            <span className="etiqueta">RANKING INTEGRADO</span>
            <h2>Critérios do Ranking Integrado e classificação das contribuições</h2>
          </div>
          <p>Os critérios ponderados qualificam o conjunto de ativos, passivos e propostas antes da consolidação técnica.</p>
        </section>

        <section className="pesos">
          <article style={{ borderTopColor: CORES_IDENTIDADE.vermelho }}>
            <strong>40%</strong>
            <span>Adesão aos desafios e maturidade de monitoramento</span>
          </article>
          <article style={{ borderTopColor: CORES_IDENTIDADE.turquesa }}>
            <strong>25%</strong>
            <span>Votação e contribuição da escuta</span>
          </article>
          <article style={{ borderTopColor: CORES_IDENTIDADE.amarelo }}>
            <strong>20%</strong>
            <span>Qualidade das informações e das evidências enviadas</span>
          </article>
          <article style={{ borderTopColor: CORES_IDENTIDADE.laranja }}>
            <strong>15%</strong>
            <span>Factibilidade fiscal orientativa a partir das referências da SEFAZ</span>
          </article>
        </section>

        <section className="classificacoes">
          <article className="classificacao classificacao--ativo">
            <span>Ativos estratégicos</span>
            <p>Recursos naturais ou competências duradouras com capacidade de contribuir para o desenvolvimento sustentável do Maranhão.</p>
          </article>
          <article className="classificacao classificacao--passivo">
            <span>Passivos e fragilidades</span>
            <p>Gargalos, riscos e desafios estruturais que exigem enfrentamento para não comprometer o futuro do estado.</p>
          </article>
          <article className="classificacao classificacao--proposta">
            <span>Propostas</span>
            <p>Temas, ideias, projetos, diretrizes ou iniciativas apresentadas pelas entidades para ampliar resultados e superar desafios.</p>
          </article>
        </section>

        <section className="cartao cartao--grafico-classificacao">
          <div className="cartao-titulo">
            <span className="barra-titulo barra-titulo--vermelho" />
            <div>
              <h2>Gráfico 1 – Classificação das contribuições do Ranking Integrado</h2>
              <p>Participação de ativos, passivos e propostas no recorte selecionado.</p>
            </div>
          </div>
          <ReactECharts option={graficoTipo} style={{ height: 340 }} />
        </section>

        <section className="titulo-secao">
          <div>
            <span className="etiqueta">COBERTURA INSTITUCIONAL</span>
            <h2>Cobertura das contribuições institucionais</h2>
          </div>
          <p>Amplitude das fontes que formaram o Ranking Integrado e a escuta que complementou a leitura técnica.</p>
        </section>

        <section className="cards">
          <article className="card-kpi card-kpi--vermelho">
            <span>Contribuições integradas</span>
            <strong>{ranking.length}</strong>
          </article>
          <article className="card-kpi card-kpi--turquesa">
            <span>Instituições com documentos</span>
            <strong>{entidadesInstitucionais.length}</strong>
          </article>
          <article className="card-kpi card-kpi--amarelo">
            <span>Registros da escuta técnica</span>
            <strong>{escuta.length}</strong>
          </article>
          <article className="card-kpi card-kpi--laranja">
            <span>Áreas de resultado</span>
            <strong>{AREAS.length}</strong>
          </article>
        </section>

        <section className="grade-graficos">
          <article className="cartao">
            <div className="cartao-titulo">
              <span className="barra-titulo barra-titulo--turquesa" />
              <div>
                <h2>Gráfico 2 – Cobertura das contribuições por origem</h2>
                <p>Quantidade de registros institucionalizados e de evidências da escuta técnica.</p>
              </div>
            </div>
            <ReactECharts option={graficoCoberturaInstitucional} style={{ height: 430 }} />
          </article>

          <article className="cartao">
            <div className="cartao-titulo">
              <span className="barra-titulo barra-titulo--vermelho" />
              <div>
                <h2>Gráfico 3 – Contribuições por Área de Resultado</h2>
                <p>Distribuição do recorte selecionado entre as cinco áreas estratégicas.</p>
              </div>
            </div>
            <ReactECharts option={graficoArea} style={{ height: 430 }} />
          </article>
        </section>

        <section className="titulo-secao">
          <div>
            <span className="etiqueta">CONSTRUÇÃO COLETIVA</span>
            <h2>Quem contribuiu e como a proposta foi construída</h2>
          </div>
          <p>Documentos institucionais, escuta técnica e análise do GT foram integrados em uma trilha única de decisão.</p>
        </section>

        <section className="grade-construcao-proposta">
          <article className="cartao">
            <div className="cartao-titulo">
              <span className="barra-titulo barra-titulo--turquesa" />
              <div>
                <h2>Instituições que contribuíram</h2>
                <p>{entidadesInstitucionais.length} instituições encaminharam documentos para análise, complementadas pela Escuta Técnica.</p>
              </div>
            </div>
            <div className="lista-entidades">
              {entidadesInstitucionais.map(([entidade, total]) => (
                <span key={entidade}>{entidade}<b>{total}</b></span>
              ))}
              <span className="lista-entidades__escuta">Escuta Técnica<b>{escuta.length}</b></span>
            </div>
          </article>

          <article className="cartao">
            <div className="cartao-titulo">
              <span className="barra-titulo barra-titulo--amarelo" />
              <div>
                <h2>Da evidência à Proposta Final</h2>
                <p>A consolidação preserva a rastreabilidade de cada item e a contribuição que lhe deu suporte.</p>
              </div>
            </div>
            <ol className="trilha-proposta">
              <li>Documentos e evidências foram organizados por órgão e Área de Resultado.</li>
              <li>Ativos, passivos e propostas foram vinculados aos desafios e indicadores do Plano.</li>
              <li>A escuta técnica, a qualidade das evidências e a factibilidade orientaram a requalificação no GT.</li>
              <li>A Proposta Final reuniu os itens validados com vínculo expansível para suas evidências.</li>
            </ol>
          </article>
        </section>
      </>}

      {visao === 'Ranking Consolidado' && (
        <>
          <section className="titulo-secao">
            <div>
              <span className="etiqueta">BASE INTEGRADA</span>
              <h2>Itens consolidados</h2>
            </div>
            <p>As {ranking.length} contribuições, ativos, passivos e propostas que compõem a base completa do processo.</p>
          </section>

          <section className="cartao">
          <div className="cartao-titulo">
            <span className="barra-titulo barra-titulo--vermelho" />
            <div>
              <h2>Lista completa de contribuições consolidadas</h2>
              <p>Ordenada pelo score final. Use os filtros para comparar áreas, tipos e entidades.</p>
            </div>
          </div>

          <div className="ranking-controles">
            <div className="ranking-resumo">
              <span>
                <strong>{totalRegistrosRanking}</strong> registro(s) encontrado(s)
              </span>
              <small>
                Ordenação: {campoOrdenacao === 'Score final (0–100)' ? 'Score' : campoOrdenacao}
                {' · '}
                {direcaoOrdenacao === 'asc' ? 'crescente' : 'decrescente'}
              </small>
            </div>

            <div className="ranking-acoes">
              <button
                type="button"
                className="botao-exportar"
                onClick={() => baixarCsv(rankingOrdenado)}
                disabled={totalRegistrosRanking === 0}
              >
                ↓ Exportar CSV
              </button>

              <label>
                Exibir
                <select
                  value={itensPorPagina}
                  onChange={(evento) => setItensPorPagina(Number(evento.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                por página
              </label>
            </div>
          </div>

          <TabelaRanking
            registros={rankingPaginado}
            campoOrdenacao={campoOrdenacao}
            direcaoOrdenacao={direcaoOrdenacao}
            aoOrdenar={ordenarRanking}
          />

          <div className="paginacao">
            <span>
              Mostrando {totalRegistrosRanking === 0 ? 0 : inicioPagina + 1}–
              {Math.min(fimPagina, totalRegistrosRanking)} de {totalRegistrosRanking}
            </span>

            <div className="paginacao-acoes">
              <button
                type="button"
                onClick={() => setPaginaAtual((pagina) => Math.max(1, pagina - 1))}
                disabled={paginaAtual === 1}
                aria-label="Página anterior"
              >
                ←
              </button>

              <div className="paginacao-paginas" aria-label="Páginas do ranking">
                {paginasRanking.map((item, indice) =>
                  item === '…'
                    ? <span className="reticencias" key={`reticencias-${indice}`}>…</span>
                    : (
                      <button
                        type="button"
                        key={item}
                        className={`pagina-numero ${item === paginaAtual ? 'ativa' : ''}`}
                        onClick={() => setPaginaAtual(item)}
                        aria-current={item === paginaAtual ? 'page' : undefined}
                      >
                        {item}
                      </button>
                    ),
                )}
              </div>

              <button
                type="button"
                onClick={() => setPaginaAtual((pagina) => Math.min(totalPaginasRanking, pagina + 1))}
                disabled={paginaAtual >= totalPaginasRanking}
                aria-label="Próxima página"
              >
                →
              </button>
            </div>
          </div>
        </section>

        </>
      )}

      {visao === 'Proposta Final' && (
        <>
          <section className="titulo-secao">
            <div>
              <span className="etiqueta">SÍNTESE EXECUTIVA DO GT</span>
              <h2>Lista final de ativos e passivos estratégicos</h2>
            </div>
            <p>
              Síntese técnica requalificada no Grupo de Trabalho com a Superintendente,
              integrando evidências institucionais, critérios de viabilidade e escuta técnica.
            </p>
          </section>

          <section className="cartao cartao--lista-final">
            <div className="cartao-titulo">
              <span className="barra-titulo barra-titulo--turquesa" />
              <div>
                <h2>Lista final validada no GT</h2>
                <p>
                  {consolidadoFiltrado.length} itens, sendo {ativosConsolidados.length} ativos e {passivosConsolidados.length} passivos.
                  {' '}Todos os itens anteriormente identificados como “a validar” foram considerados validados para fins de apresentação da prioridade.
                  {' '}Use “Ver convergência de evidências” para consultar as contribuições integradas que robustecem cada item.
                </p>
              </div>
            </div>
            <TabelaRanking
              registros={consolidadoFiltrado}
              rotuloScore="Score-base"
              mostrarConvergenciaDeEvidencias
              normalizarPrioridade
            />
          </section>

          <section className="cards cards--sintese-final">
            <article className="card-kpi card-kpi--turquesa">
              <span>Ativos estratégicos</span>
              <strong>{ativosConsolidados.length}</strong>
              <small>{percentual(ativosConsolidados.length, consolidadoFiltrado.length).toFixed(0)}% da lista final</small>
            </article>
            <article className="card-kpi card-kpi--vermelho">
              <span>Passivos críticos</span>
              <strong>{passivosConsolidados.length}</strong>
              <small>{percentual(passivosConsolidados.length, consolidadoFiltrado.length).toFixed(0)}% da lista final</small>
            </article>
            <article className="card-kpi card-kpi--amarelo">
              <span>Itens finais do GT</span>
              <strong>{consolidadoFiltrado.length}</strong>
              <small>cinco áreas de resultado</small>
            </article>
            <article className="card-kpi card-kpi--laranja">
              <span>Prioridade alta ou muito alta</span>
              <strong>{totalPrioridadeAltaFinal}</strong>
              <small>{percentual(totalPrioridadeAltaFinal, consolidadoFiltrado.length).toFixed(0)}% do conjunto final</small>
            </article>
          </section>

          <section className="grade-executiva-final">
            <article className="cartao">
              <div className="cartao-titulo">
                <span className="barra-titulo barra-titulo--turquesa" />
                <div>
                  <h2>Gráfico 4 – Composição final por área e tipo</h2>
                  <p>Anel interno: ativos e passivos. Anel externo: distribuição quantitativa nas áreas de resultado.</p>
                </div>
              </div>
              {consolidadoFiltrado.length > 0
                ? <ReactECharts option={graficoComposicaoFinal} style={{ height: 470 }} />
                : <p className="escuta-sem-registros">Nenhum item final corresponde aos filtros atuais.</p>}
            </article>

            <article className="cartao cartao--leitura-final">
              <div className="cartao-titulo">
                <span className="barra-titulo barra-titulo--amarelo" />
                <div>
                  <h2>Leitura executiva do conjunto</h2>
                  <p>Principais sinais quantitativos da lista requalificada.</p>
                </div>
              </div>
              <div className="leituras-final">
                {areaMaisRepresentadaFinal && (
                  <p className="leitura-final">
                    <strong>Maior concentração.</strong>{' '}
                    {areaMaisRepresentadaFinal.nome} reúne {areaMaisRepresentadaFinal.total} de {consolidadoFiltrado.length} itens
                    {' '}({percentual(areaMaisRepresentadaFinal.total, consolidadoFiltrado.length).toFixed(0)}%),
                    com {areaMaisRepresentadaFinal.ativos} ativo(s) e {areaMaisRepresentadaFinal.passivos} passivo(s).
                  </p>
                )}
                {recorteSociedadeFinal && (
                  <p className="leitura-final">
                    <strong>Foco de superação.</strong>{' '}
                    {recorteSociedadeFinal.nome} concentra {recorteSociedadeFinal.passivos} passivo(s) e {recorteSociedadeFinal.ativos} ativo(s),
                    sinalizando uma agenda prioritária de enfrentamento de fragilidades sociais estruturais.
                  </p>
                )}
                <p className="leitura-final">
                  <strong>Grau de prioridade.</strong>{' '}
                  {totalPrioridadeAltaFinal} dos {consolidadoFiltrado.length} itens estão classificados como alta ou muito alta prioridade;
                  o score-base médio do conjunto é {scoreMedioFinal.toFixed(1)}.
                </p>
                <p className="leitura-final">
                  <strong>Status de prioridade.</strong>{' '}
                  Os itens originalmente marcados como “a validar” foram incorporados como validados na leitura final;
                  a priorização exibida orienta a pactuação posterior de metas, responsáveis e recursos.
                </p>
              </div>
            </article>
          </section>

          <section className="cartao cartao--areas-final">
            <div className="cartao-titulo">
              <span className="barra-titulo barra-titulo--vermelho" />
              <div>
                <h2>Distribuição da lista final nas áreas de resultado</h2>
                <p>Leitura quantitativa complementar à composição do gráfico, preservando as cores oficiais de cada área.</p>
              </div>
            </div>
            <div className="matriz-areas-final">
              {distribuicaoFinalPorArea.map((item) => (
                <article className="area-final" key={item.chave} style={{ borderTopColor: item.cor }}>
                  <span className="area-final__nome">{item.nome}</span>
                  <strong>{item.total}</strong>
                  <span className="area-final__subtitulo">itens finais</span>
                  <div className="area-final__dados">
                    <span><i className="legenda-tipo legenda-tipo--ativo" />{item.ativos} ativo(s)</span>
                    <span><i className="legenda-tipo legenda-tipo--passivo" />{item.passivos} passivo(s)</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="titulo-secao titulo-secao--destaques">
            <div>
              <span className="etiqueta">DESTAQUES ESTRATÉGICOS</span>
              <h2>Figuras 1 e 2 – Ativos e passivos em evidência</h2>
            </div>
            <p>Leitura visual inspirada na matriz de ativos e fragilidades: os números indicam a posição entre os destaques por score-base.</p>
          </section>

          <section className="grade-destaques">
            <MapaDestaques tipo="Ativo" registros={ativosConsolidados} />
            <MapaDestaques tipo="Passivo" registros={passivosConsolidados} />
          </section>

          <aside className="aviso">
            <strong>Leitura metodológica.</strong> A lista final registra a requalificação técnica do GT. Os vínculos, as evidências e os condicionamentos permanecem acessíveis por item; o score-base é uma referência de priorização e não substitui a pactuação posterior de metas, responsáveis e recursos.
          </aside>

        </>
      )}

      {visao === 'Escuta Técnica' && (
        <>
          <section className="titulo-secao">
            <div>
              <span className="etiqueta">CÂMARAS TÉCNICAS</span>
              <h2>Escuta técnica: prioridades e evidências</h2>
            </div>
            <p>Gráficos, eleições e itens priorizados pelas Câmaras Técnicas que subsidiaram a consolidação final.</p>
          </section>

          <section className="cards cards--escuta">
            <article className="card-kpi card-kpi--turquesa">
              <span>Participantes válidos</span>
              <strong>{participantesEscuta}</strong>
            </article>
            <article className="card-kpi card-kpi--amarelo">
              <span>Ativos priorizados</span>
              <strong>{ativosPriorizadosEscuta.length}</strong>
            </article>
            <article className="card-kpi card-kpi--vermelho">
              <span>Passivos priorizados</span>
              <strong>{passivosPriorizadosEscuta.length}</strong>
            </article>
            <article className="card-kpi card-kpi--laranja">
              <span>Itens com eleição</span>
              <strong>{totalPriorizadosEscuta}</strong>
            </article>
          </section>

          <section className="grade-graficos">
            <article className="cartao">
              <div className="cartao-titulo">
                <span className="barra-titulo barra-titulo--turquesa" />
                <div>
                  <h2>Gráfico 5 – Ativos mais priorizados na escuta técnica</h2>
                  <p>Quantidade de participantes que elegeram cada ativo entre as prioridades.</p>
                </div>
              </div>
              {ativosPriorizadosEscuta.length > 0
                ? <ReactECharts option={graficoAtivosEscuta} style={{ height: 390 }} />
                : <p className="escuta-sem-registros">Nenhum ativo priorizado no recorte atual.</p>}
            </article>

            <article className="cartao">
              <div className="cartao-titulo">
                <span className="barra-titulo barra-titulo--vermelho" />
                <div>
                  <h2>Gráfico 6 – Passivos mais priorizados na escuta técnica</h2>
                  <p>Quantidade de participantes que elegeram cada passivo entre as prioridades.</p>
                </div>
              </div>
              {passivosPriorizadosEscuta.length > 0
                ? <ReactECharts option={graficoPassivosEscuta} style={{ height: 390 }} />
                : <p className="escuta-sem-registros">Nenhum passivo priorizado no recorte atual.</p>}
            </article>
          </section>

          <section className="cartao">
            <div className="cartao-titulo">
              <span className="barra-titulo barra-titulo--turquesa" />
              <div>
                <h2>Ativos eleitos como prioritários</h2>
                <p>Ordenação por número de eleições; os detalhes mantêm a evidência e a vinculação ao Plano.</p>
              </div>
            </div>
            <TabelaEscuta registros={ativosPriorizadosEscuta} tipo="Ativo" />
          </section>

          <section className="cartao">
            <div className="cartao-titulo">
              <span className="barra-titulo barra-titulo--vermelho" />
              <div>
                <h2>Passivos eleitos como prioritários</h2>
                <p>Ordenação por número de eleições; gravidade e urgência apoiam a leitura da prioridade.</p>
              </div>
            </div>
            <TabelaEscuta registros={passivosPriorizadosEscuta} tipo="Passivo" />
          </section>
        </>
      )}

      {visao === 'Referências do Plano' && <>
        <section className="titulo-secao">
          <div>
            <span className="etiqueta">BASE TEÓRICA DO PLANO</span>
            <h2>Desafios e indicadores estratégicos do Plano Maranhão 2050</h2>
          </div>
          <p>A referência teórica que orienta a vinculação temática, a leitura das lacunas e a revisão de longo prazo.</p>
        </section>

        <section className="cartao">
          <div className="cartao-titulo">
            <span className="barra-titulo barra-titulo--amarelo" />
            <div>
              <h2>{referenciasPlano.titulo}</h2>
              <p>{referenciasPlano.nota}</p>
            </div>
          </div>

          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Área de Resultado</th>
                  <th>Desafio estratégico</th>
                  <th>Indicador principal de apoio</th>
                  <th>Fonte</th>
                </tr>
              </thead>
              <tbody>
                {referenciasPlano.desafios.map((registro) => (
                  <tr key={texto(registro.Nº)}>
                    <td>{texto(registro.Nº)}</td>
                    <td><span className="area" style={{ backgroundColor: corArea(registro['Área de resultado']) }}>{nomeArea(registro['Área de resultado'])}</span></td>
                    <td><strong>{texto(registro['Desafio estratégico'])}</strong></td>
                    <td>{texto(registro['Indicador principal de apoio'])}</td>
                    <td>{texto(registro.Fonte)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cartao">
          <div className="cartao-titulo">
            <span className="barra-titulo barra-titulo--turquesa" />
            <div>
              <h2>Indicadores de monitoramento usados na vinculação temática</h2>
              <p>Referências de acompanhamento empregadas para aproximar as contribuições dos desafios estratégicos do Plano.</p>
            </div>
          </div>

          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Área de Resultado</th>
                  <th>Indicador</th>
                  <th>Último valor disponível</th>
                  <th>Ano</th>
                  <th>Uso na matriz</th>
                </tr>
              </thead>
              <tbody>
                {referenciasPlano.indicadores.map((registro) => (
                  <tr key={`${texto(registro['Área de resultado'])}-${texto(registro.Indicador)}`}>
                    <td><span className="area" style={{ backgroundColor: corArea(registro['Área de resultado']) }}>{nomeArea(registro['Área de resultado'])}</span></td>
                    <td><strong>{texto(registro.Indicador)}</strong></td>
                    <td>{texto(registro['Último valor disponível'])}</td>
                    <td>{texto(registro.Ano)}</td>
                    <td>{texto(registro['Uso na matriz'])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cartao">
          <div className="cartao-titulo">
            <span className="barra-titulo barra-titulo--laranja" />
            <div>
              <h2>Referências complementares para lacunas e monitoramento</h2>
              <p>Sistemas de referência, benchmarks e aplicações que apoiam a agenda de monitoramento do Maranhão 2050.</p>
            </div>
          </div>

          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Sistema / painel</th>
                  <th>Instituição</th>
                  <th>Lacunas atendidas</th>
                  <th>Aplicação</th>
                </tr>
              </thead>
              <tbody>
                {lacunas.map((registro) => (
                  <tr key={texto(registro['Sistema / painel'])}>
                    <td>{texto(registro.Estado)}</td>
                    <td><strong>{texto(registro['Sistema / painel'])}</strong></td>
                    <td>{texto(registro['Instituição responsável'])}</td>
                    <td>{texto(registro['Lacunas atendidas'])}</td>
                    <td>{texto(registro['Aplicação no DataIMESC / Maranhão 2050'])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>}

      <footer className="rodape">
        <span>Plano Maranhão 2050</span>
        <span>Monitoramento · revisão · priorização estratégica</span>
      </footer>
    </main>
  )
}

export default App
