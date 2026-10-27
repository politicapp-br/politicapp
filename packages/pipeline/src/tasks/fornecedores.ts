import {
  parlamentarKey,
  tipoDespesaCurto,
  type Casa,
  type FornecedorDaCota,
  type FornecedoresDoParlamentar,
  type LancamentoDestaque,
} from "@politicapp/data"

import type { LancamentoDespesa } from "../sources/camara"
import { chaveDeNome } from "../sources/senado"

export const PRINCIPAIS_FORNECEDORES = 10
export const MAIORES_LANCAMENTOS = 5

const dinheiro = (valor: number) => Math.round(valor * 100) / 100
const fracao = (valor: number) => Math.round(valor * 1000) / 1000

const digitos = (documento: string | null) => documento?.replace(/\D/g, "") ?? ""

/**
 * Razão social de MEI costuma terminar com o CPF do dono
 * ("FULANO DE TAL 12345678901"); o nome publicado vai sem ele.
 */
export const semCpfNoNome = (nome: string) =>
  nome.replace(/[\s-]*\d{3}\.?\d{3}\.?\d{3}-?\d{2}\s*$/, "").trim()

/** CPF tem 11 dígitos; CNPJ, 14. Documento vazio não é pessoa física. */
const ehPessoaFisica = (documento: string | null) => digitos(documento).length === 11

/** Mesmo fornecedor aparece com grafias diferentes; o documento é a identidade. */
const chaveDoFornecedor = ({ cnpjCpf, fornecedor }: LancamentoDespesa) => {
  const numero = digitos(cnpjCpf)
  return numero.length > 0 ? numero : `nome:${chaveDeNome(fornecedor)}`
}

type AcumuladoFornecedor = {
  nome: string
  documento: string | null
  pessoaFisica: boolean
  total: number
  lancamentos: number
}

/** Detalhe da cota de cada parlamentar da casa no ano. */
export const detalharFornecedores = (
  casa: Casa,
  ano: number,
  lancamentos: LancamentoDespesa[],
): Map<string, FornecedoresDoParlamentar> => {
  const doAno = lancamentos.filter((lancamento) => lancamento.ano === ano)

  const pagadoresPorFornecedor = new Map<string, Set<string>>()
  const porParlamentar = new Map<string, LancamentoDespesa[]>()
  for (const lancamento of doAno) {
    const chave = chaveDoFornecedor(lancamento)
    const pagadores = pagadoresPorFornecedor.get(chave) ?? new Set<string>()
    if (lancamento.valor > 0) pagadores.add(lancamento.parlamentarId)
    pagadoresPorFornecedor.set(chave, pagadores)

    const lista = porParlamentar.get(lancamento.parlamentarId)
    if (lista) lista.push(lancamento)
    else porParlamentar.set(lancamento.parlamentarId, [lancamento])
  }

  const resultado = new Map<string, FornecedoresDoParlamentar>()

  for (const [id, todos] of porParlamentar) {
    const pagos = todos.filter((lancamento) => lancamento.valor > 0)
    const total = pagos.reduce((soma, { valor }) => soma + valor, 0)

    const fornecedores = new Map<string, AcumuladoFornecedor>()
    for (const lancamento of pagos) {
      const chave = chaveDoFornecedor(lancamento)
      const atual = fornecedores.get(chave) ?? {
        nome: semCpfNoNome(lancamento.fornecedor.trim()),
        documento: ehPessoaFisica(lancamento.cnpjCpf) ? null : lancamento.cnpjCpf,
        pessoaFisica: ehPessoaFisica(lancamento.cnpjCpf),
        total: 0,
        lancamentos: 0,
      }
      atual.total += lancamento.valor
      atual.lancamentos += 1
      fornecedores.set(chave, atual)
    }

    const ordenados = [...fornecedores].sort(
      ([a, x], [b, y]) => y.total - x.total || a.localeCompare(b),
    )
    const principais: FornecedorDaCota[] = ordenados
      .slice(0, PRINCIPAIS_FORNECEDORES)
      .map(([chave, fornecedor]) => ({
        // Pessoa física não tem o nome publicado: o CPF e o nome juntos a identificam.
        nome: fornecedor.pessoaFisica ? "Pessoa física" : fornecedor.nome,
        documento: fornecedor.documento,
        total: dinheiro(fornecedor.total),
        lancamentos: fornecedor.lancamentos,
        fracao: total > 0 ? fracao(fornecedor.total / total) : 0,
        exclusivo: (pagadoresPorFornecedor.get(chave)?.size ?? 0) === 1,
      }))

    const top3 = ordenados.slice(0, 3).reduce((soma, [, { total: valor }]) => soma + valor, 0)
    const pessoaFisica = pagos.filter(({ cnpjCpf }) => ehPessoaFisica(cnpjCpf))

    const maioresLancamentos: LancamentoDestaque[] = [...pagos]
      .sort((a, b) => b.valor - a.valor)
      .slice(0, MAIORES_LANCAMENTOS)
      .map((lancamento) => ({
        data: lancamento.data,
        fornecedor: ehPessoaFisica(lancamento.cnpjCpf)
          ? "Pessoa física"
          : semCpfNoNome(lancamento.fornecedor.trim()),
        tipo: tipoDespesaCurto(lancamento.tipo),
        valor: dinheiro(lancamento.valor),
        // A nota de pessoa física traz nome e CPF de quem recebeu.
        documentoUrl: ehPessoaFisica(lancamento.cnpjCpf) ? null : lancamento.documentoUrl,
      }))

    resultado.set(parlamentarKey({ casa, id }), {
      ano,
      total: dinheiro(total),
      quantidade: fornecedores.size,
      principais,
      concentracaoTop3: total > 0 ? fracao(top3 / total) : 0,
      pessoaFisica: {
        valor: dinheiro(pessoaFisica.reduce((soma, { valor }) => soma + valor, 0)),
        lancamentos: pessoaFisica.length,
      },
      glosado:
        casa === "camara" ? dinheiro(todos.reduce((soma, { glosa }) => soma + glosa, 0)) : null,
      maioresLancamentos,
    })
  }

  return resultado
}
