/**
 * Quem ocupa os postos que nenhuma fonte estruturada publica: presidência,
 * Judiciário, PGR/AGU/DPU e governadores em exercício. Também dá nome público,
 * partido e Wikidata (para a foto) aos ministros que o e-Agendas lista só pelo
 * nome civil em caixa alta.
 *
 * Pesquisado em fontes oficiais e imprensa em 27/10/2026 (cada entrada tem a
 * fonte). Muda poucas vezes por ano; a aba de mudanças do app e o validador
 * apontam quando algo daqui deve ter ficado velho.
 */

export const CURADORIA_VERIFICADA_EM = "2026-10-27"

export type PessoaCurada = {
  slug: string
  nome: string
  partido: string | null
  wikidata: string | null
  desde: string | null
  fonte: string
}

export const PRESIDENCIA = {
  presidente: {
    slug: "lula",
    nome: "Luiz Inácio Lula da Silva",
    partido: "PT",
    wikidata: "Q37181",
    desde: "2023-01-01",
    ate: "2027-01-05",
    fonte: "https://www.gov.br/planalto/pt-br/conheca-a-presidencia/presidente",
  },
  vice: {
    slug: "alckmin",
    nome: "Geraldo Alckmin",
    partido: "PSB",
    wikidata: "Q964493",
    desde: "2023-01-01",
    ate: "2027-01-05",
    fonte: "https://www.gov.br/planalto/pt-br/conheca-a-vice-presidencia",
  },
} satisfies Record<string, PessoaCurada & { ate: string }>

/**
 * Ministros pelo nome civil como o e-Agendas escreve (sem acento, caixa alta,
 * comparado por `chaveDeNome`). Ministro novo que não está aqui aparece com o
 * nome civil, sem partido e sem foto, e o pipeline avisa no log.
 */
export const MINISTROS: Record<string, { nome: string; partido: string | null; wikidata: string | null }> = {
  "ANDRE CARLOS ALVES DE PAULA FILHO": { nome: "André de Paula", partido: "PSD", wikidata: "Q16490361" },
  "ANTONIO VLADIMIR MOURA LIMA": { nome: "Vladimir Lima", partido: null, wikidata: null },
  "LUCIANA BARBOSA DE OLIVEIRA SANTOS": { nome: "Luciana Santos", partido: "PCDOB", wikidata: "Q10320247" },
  "FREDERICO DE SIQUEIRA FILHO": { nome: "Frederico Siqueira", partido: null, wikidata: "Q134109651" },
  "MARGARETH MENEZES DA PURIFICACAO": { nome: "Margareth Menezes", partido: null, wikidata: "Q273347" },
  "JOSE MUCIO MONTEIRO FILHO": { nome: "José Múcio", partido: null, wikidata: "Q10310181" },
  "FERNANDA MACHIAVELI MORAO DE OLIVEIRA": { nome: "Fernanda Machiaveli", partido: null, wikidata: "Q140667830" },
  "MARCIO FERNANDO ELIAS ROSA": { nome: "Márcio Elias Rosa", partido: null, wikidata: "Q61000504" },
  "JOSE WELLINGTON BARROSO DE ARAUJO DIAS": { nome: "Wellington Dias", partido: "PT", wikidata: "Q7981381" },
  "JANINE MELLO DOS SANTOS": { nome: "Janine Mello", partido: null, wikidata: "Q140671194" },
  "LEONARDO OSVALDO BARCHINI ROSA": { nome: "Leonardo Barchini", partido: null, wikidata: "Q138845804" },
  "PAULO HENRIQUE RODRIGUES PEREIRA": { nome: "Paulo Henrique Pereira", partido: "PSB", wikidata: null },
  "PAULO HENRIQUE PERNA CORDEIRO": { nome: "Paulo Henrique Perna Cordeiro", partido: null, wikidata: null },
  "DARIO CARNEVALLI DURIGAN": { nome: "Dario Durigan", partido: null, wikidata: "Q138701904" },
  "ESTHER DWECK": { nome: "Esther Dweck", partido: null, wikidata: "Q96140229" },
  "RACHEL BARROS DE OLIVEIRA": { nome: "Rachel Barros", partido: null, wikidata: "Q140335624" },
  "ANTONIO WALDEZ GOES DA SILVA": { nome: "Waldez Góes", partido: "PDT", wikidata: "Q9095459" },
  "WELLINGTON CESAR LIMA E SILVA": { nome: "Wellington César Lima e Silva", partido: null, wikidata: "Q23893528" },
  "JOAO PAULO RIBEIRO CAPOBIANCO": { nome: "João Paulo Capobianco", partido: null, wikidata: "Q10311976" },
  "ALEXANDRE SILVEIRA DE OLIVEIRA": { nome: "Alexandre Silveira", partido: "PSD", wikidata: "Q16336362" },
  "MARCIA HELENA CARVALHO LOPES": { nome: "Márcia Lopes", partido: "PT", wikidata: "Q10334261" },
  "RIVETLA EDIPO ARAUJO CRUZ": { nome: "Rivetla Édipo", partido: null, wikidata: null },
  "BRUNO MORETTI": { nome: "Bruno Moretti", partido: null, wikidata: null },
  "TOME BARROS MONTEIRO DA FRANCA": { nome: "Tomé Franca", partido: null, wikidata: "Q140680182" },
  "LUIZ HENRIQUE ELOY AMADO": { nome: "Eloy Terena", partido: null, wikidata: "Q65166940" },
  "WOLNEY QUEIROZ MACIEL": { nome: "Wolney Queiroz", partido: "PDT", wikidata: "Q10393971" },
  "MAURO LUIZ IECKER VIEIRA": { nome: "Mauro Vieira", partido: null, wikidata: "Q18708068" },
  "ALEXANDRE ROCHA SANTOS PADILHA": { nome: "Alexandre Padilha", partido: "PT", wikidata: "Q4163528" },
  "LUIZ MARINHO": { nome: "Luiz Marinho", partido: "PT", wikidata: "Q10320792" },
  "GEORGE ANDRE PALERMO SANTORO": { nome: "George Santoro", partido: null, wikidata: "Q116159639" },
  "GUSTAVO COSTA FELICIANO": { nome: "Gustavo Feliciano", partido: null, wikidata: "Q137562818" },
  "MIRIAM BELCHIOR": { nome: "Miriam Belchior", partido: "PT", wikidata: "Q10330636" },
  "GUILHERME CASTRO BOULOS": { nome: "Guilherme Boulos", partido: "PSOL", wikidata: "Q20045809" },
  "JOSE NOBRE GUIMARAES": { nome: "José Guimarães", partido: "PT", wikidata: "Q10310206" },
  "SIDONIO CARDOSO PALMEIRA": { nome: "Sidônio Palmeira", partido: null, wikidata: "Q131840556" },
  "MARCOS ANTONIO AMARO DOS SANTOS": { nome: "Marcos Amaro", partido: null, wikidata: "Q59572093" },
  "VINICIUS MARQUES DE CARVALHO": { nome: "Vinícius Marques de Carvalho", partido: null, wikidata: "Q115950553" },
  // Ministros anteriores do governo, para o histórico e as mudanças.
  "NISIA VERONICA TRINDADE LIMA": { nome: "Nísia Trindade", partido: null, wikidata: "Q96741667" },
}

/** A AGU não publica no e-Agendas; o titular vem daqui. */
export const AGU: PessoaCurada = {
  slug: "jorge-messias",
  nome: "Jorge Messias",
  partido: null,
  wikidata: "Q115950187",
  desde: "2023-01-01",
  fonte: "https://www.gov.br/agu/pt-br/composicao/advogado-geral-da-uniao",
}

export type MinistroStfCurado = {
  slug: string
  nome: string
  nascimento: string
  indicadoPor: string
  posse: string
  aprovacao: { data: string; favor: number; contra: number } | null
  turma: 1 | 2 | null
  funcao: "Presidente" | "Vice-presidente" | null
  fonte: string
}

const STF_MINISTROS = "https://portal.stf.jus.br/ostf/ministros/ministro.asp"

export const STF: MinistroStfCurado[] = [
  { slug: "edson-fachin", nome: "Edson Fachin", nascimento: "1958-02-08", indicadoPor: "Dilma Rousseff", posse: "2015-06-16", aprovacao: { data: "2015-05-19", favor: 52, contra: 27 }, turma: null, funcao: "Presidente", fonte: STF_MINISTROS },
  { slug: "alexandre-de-moraes", nome: "Alexandre de Moraes", nascimento: "1968-12-13", indicadoPor: "Michel Temer", posse: "2017-03-22", aprovacao: { data: "2017-02-22", favor: 55, contra: 13 }, turma: 1, funcao: "Vice-presidente", fonte: STF_MINISTROS },
  { slug: "gilmar-mendes", nome: "Gilmar Mendes", nascimento: "1955-12-30", indicadoPor: "Fernando Henrique Cardoso", posse: "2002-06-20", aprovacao: { data: "2002-05-22", favor: 57, contra: 15 }, turma: 2, funcao: null, fonte: STF_MINISTROS },
  { slug: "carmen-lucia", nome: "Cármen Lúcia", nascimento: "1954-04-19", indicadoPor: "Luiz Inácio Lula da Silva", posse: "2006-06-21", aprovacao: { data: "2006-05-24", favor: 55, contra: 1 }, turma: 1, funcao: null, fonte: STF_MINISTROS },
  { slug: "dias-toffoli", nome: "Dias Toffoli", nascimento: "1967-11-15", indicadoPor: "Luiz Inácio Lula da Silva", posse: "2009-10-23", aprovacao: { data: "2009-09-30", favor: 58, contra: 9 }, turma: 2, funcao: null, fonte: STF_MINISTROS },
  { slug: "luiz-fux", nome: "Luiz Fux", nascimento: "1953-04-26", indicadoPor: "Dilma Rousseff", posse: "2011-03-03", aprovacao: { data: "2011-02-09", favor: 68, contra: 2 }, turma: 2, funcao: null, fonte: STF_MINISTROS },
  { slug: "nunes-marques", nome: "Nunes Marques", nascimento: "1972-05-16", indicadoPor: "Jair Bolsonaro", posse: "2020-11-05", aprovacao: { data: "2020-10-21", favor: 57, contra: 10 }, turma: 2, funcao: null, fonte: STF_MINISTROS },
  { slug: "andre-mendonca", nome: "André Mendonça", nascimento: "1972-12-27", indicadoPor: "Jair Bolsonaro", posse: "2021-12-16", aprovacao: { data: "2021-12-01", favor: 47, contra: 32 }, turma: 2, funcao: null, fonte: STF_MINISTROS },
  { slug: "cristiano-zanin", nome: "Cristiano Zanin", nascimento: "1975-11-15", indicadoPor: "Luiz Inácio Lula da Silva", posse: "2023-08-03", aprovacao: { data: "2023-06-21", favor: 58, contra: 18 }, turma: 1, funcao: null, fonte: STF_MINISTROS },
  { slug: "flavio-dino", nome: "Flávio Dino", nascimento: "1968-04-30", indicadoPor: "Luiz Inácio Lula da Silva", posse: "2024-02-22", aprovacao: { data: "2023-12-13", favor: 47, contra: 31 }, turma: 1, funcao: null, fonte: STF_MINISTROS },
]

/** Cadeiras vagas no STF: desde quando e por quê. */
export const STF_VAGAS = [
  {
    desde: "2025-10-18",
    motivo: "Aposentadoria de Luís Roberto Barroso. O Senado rejeitou a indicação de Jorge Messias em 29/4/2026.",
    fonte: "https://www.opovo.com.br/noticias/politica/eleicoes/2026/10/27/reeleito-lula-pode-indicar-4-ministros-ao-stf-e-6-ao-stj.html",
  },
]

export const TRIBUNAIS = [
  { sigla: "STJ", nome: "Superior Tribunal de Justiça", oQueJulga: "Dá a palavra final sobre leis federais que não envolvem a Constituição.", ministros: 33, presidente: "Luis Felipe Salomão", desde: "2026-08-19", fonte: "https://www.stj.jus.br/sites/portalp/Institucional/Composicao" },
  { sigla: "TSE", nome: "Tribunal Superior Eleitoral", oQueJulga: "Organiza as eleições e julga candidaturas, contas e cassações.", ministros: 7, presidente: "Nunes Marques", desde: "2026-05-12", fonte: "https://www.tse.jus.br/institucional/ministros" },
  { sigla: "TST", nome: "Tribunal Superior do Trabalho", oQueJulga: "Dá a palavra final em processos entre empregados e empregadores.", ministros: 27, presidente: "Vieira de Mello Filho", desde: "2025-09-25", fonte: "https://www.tst.jus.br/composicao" },
  { sigla: "STM", nome: "Superior Tribunal Militar", oQueJulga: "Julga crimes militares cometidos por integrantes das Forças Armadas.", ministros: 15, presidente: "Maria Elizabeth Rocha", desde: "2025-03-12", fonte: "https://www.stm.jus.br/o-stm-stm/composicao" },
]

export const FUNCOES = [
  { slug: "paulo-gonet", cargo: "Procurador-Geral da República", nome: "Paulo Gonet", desde: "2023-12-18", ate: "2027-12-18", nota: "Reconduzido em dezembro de 2025.", fonte: "https://www.mpf.mp.br/o-mpf/procurador-geral-da-republica" },
  { slug: "jorge-messias", cargo: "Advogado-Geral da União", nome: AGU.nome, desde: AGU.desde, ate: null, nota: null, fonte: AGU.fonte },
  { slug: "tarcijany-linhares", cargo: "Defensora Pública-Geral Federal", nome: "Tarcijany Linhares", desde: "2026-05-28", ate: null, nota: null, fonte: "https://www.dpu.def.br" },
]

type GovernadorCurado = {
  nome: string
  partido: string | null
  desde: string
  vice: { nome: string; partido: string | null } | null
  observacao: string | null
  fonte: string
}

const WIKI = "https://pt.wikipedia.org/wiki/Lista_de_governadores_das_unidades_federativas_do_Brasil"

/** Governador em exercício em cada UF, com o que mudou desde a posse de 2023. */
export const GOVERNADORES: Record<string, GovernadorCurado> = {
  AC: { nome: "Mailza Assis", partido: "PP", desde: "2026-04-02", vice: null, observacao: "Assumiu após a renúncia de Gladson Cameli em 2 abr 2026.", fonte: WIKI },
  AL: { nome: "Paulo Dantas", partido: "MDB", desde: "2022-05-15", vice: { nome: "Ronaldo Lessa", partido: "PDT" }, observacao: null, fonte: WIKI },
  AP: { nome: "Clécio Luís", partido: "UNIÃO", desde: "2023-01-01", vice: { nome: "Teles Junior", partido: "PDT" }, observacao: null, fonte: WIKI },
  AM: { nome: "Roberto Cidade", partido: "UNIÃO", desde: "2026-05-04", vice: { nome: "Serafim Corrêa", partido: "PSB" }, observacao: "Eleito pela Assembleia após as renúncias de Wilson Lima e do vice em 5 abr 2026.", fonte: WIKI },
  BA: { nome: "Jerônimo Rodrigues", partido: "PT", desde: "2023-01-01", vice: { nome: "Geraldo Júnior", partido: "MDB" }, observacao: null, fonte: WIKI },
  CE: { nome: "Elmano de Freitas", partido: "PT", desde: "2023-01-01", vice: { nome: "Jade Romero", partido: null }, observacao: null, fonte: WIKI },
  DF: { nome: "Celina Leão", partido: "PP", desde: "2026-03-30", vice: null, observacao: "Assumiu após a renúncia de Ibaneis Rocha em 28 mar 2026.", fonte: WIKI },
  ES: { nome: "Ricardo Ferraço", partido: "MDB", desde: "2026-04-02", vice: null, observacao: "Assumiu após a renúncia de Renato Casagrande em 2 abr 2026.", fonte: WIKI },
  GO: { nome: "Daniel Vilela", partido: "MDB", desde: "2026-03-31", vice: null, observacao: "Assumiu após a renúncia de Ronaldo Caiado em 31 mar 2026.", fonte: WIKI },
  MA: { nome: "Carlos Brandão", partido: null, desde: "2022-04-02", vice: { nome: "Felipe Camarão", partido: "PT" }, observacao: null, fonte: WIKI },
  MT: { nome: "Otaviano Pivetta", partido: "REPUBLICANOS", desde: "2026-03-31", vice: null, observacao: "Assumiu após a renúncia de Mauro Mendes em 31 mar 2026.", fonte: WIKI },
  MS: { nome: "Eduardo Riedel", partido: "PP", desde: "2023-01-01", vice: { nome: "Barbosinha", partido: "REPUBLICANOS" }, observacao: null, fonte: WIKI },
  MG: { nome: "Mateus Simões", partido: "PSD", desde: "2026-03-22", vice: null, observacao: "Assumiu após a renúncia de Romeu Zema em 22 mar 2026.", fonte: WIKI },
  PA: { nome: "Hana Ghassan", partido: "MDB", desde: "2026-04-02", vice: null, observacao: "Assumiu após a renúncia de Helder Barbalho em 2 abr 2026.", fonte: WIKI },
  PB: { nome: "Lucas Ribeiro", partido: "PP", desde: "2026-04-02", vice: null, observacao: "Assumiu após a renúncia de João Azevêdo em 2 abr 2026.", fonte: WIKI },
  PR: { nome: "Ratinho Júnior", partido: "PSD", desde: "2019-01-01", vice: { nome: "Darci Piana", partido: "PSD" }, observacao: null, fonte: WIKI },
  PE: { nome: "Raquel Lyra", partido: "PSD", desde: "2023-01-01", vice: { nome: "Priscila Krause", partido: "PSD" }, observacao: null, fonte: WIKI },
  PI: { nome: "Rafael Fonteles", partido: "PT", desde: "2023-01-01", vice: { nome: "Themístocles Filho", partido: "MDB" }, observacao: null, fonte: WIKI },
  RJ: { nome: "Ricardo Couto de Castro", partido: null, desde: "2026-03-24", vice: null, observacao: "Presidente do Tribunal de Justiça, governa interinamente desde a renúncia de Cláudio Castro, com a vice vaga.", fonte: WIKI },
  RN: { nome: "Fátima Bezerra", partido: "PT", desde: "2019-01-01", vice: { nome: "Walter Alves", partido: "MDB" }, observacao: null, fonte: WIKI },
  RS: { nome: "Eduardo Leite", partido: "PSD", desde: "2023-01-01", vice: { nome: "Gabriel Souza", partido: "MDB" }, observacao: null, fonte: WIKI },
  RO: { nome: "Marcos Rocha", partido: "PSD", desde: "2019-01-01", vice: { nome: "Sérgio Gonçalves", partido: "UNIÃO" }, observacao: null, fonte: WIKI },
  RR: { nome: "Soldado Sampaio", partido: "REPUBLICANOS", desde: "2026-04-30", vice: null, observacao: "Presidente da Assembleia, governa interinamente até a eleição suplementar.", fonte: WIKI },
  SC: { nome: "Jorginho Mello", partido: "PL", desde: "2023-01-01", vice: { nome: "Marilisa Boehm", partido: "PL" }, observacao: null, fonte: WIKI },
  SP: { nome: "Tarcísio de Freitas", partido: "REPUBLICANOS", desde: "2023-01-01", vice: { nome: "Felicio Ramuth", partido: "MDB" }, observacao: null, fonte: WIKI },
  SE: { nome: "Fábio Mitidieri", partido: "PSD", desde: "2023-01-01", vice: { nome: "Zezinho Sobral", partido: "PSB" }, observacao: null, fonte: WIKI },
  TO: { nome: "Wanderlei Barbosa", partido: "REPUBLICANOS", desde: "2022-03-11", vice: { nome: "Laurez Moreira", partido: "PSD" }, observacao: null, fonte: WIKI },
}

/** Mandato dos governadores em exercício termina na posse dos eleitos em 2026. */
export const FIM_MANDATO_GOVERNADOR = "2027-01-06"
