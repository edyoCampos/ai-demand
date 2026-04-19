---
name: token-reduce
description: >
  Engine de compressão de prompts baseada em LLMLingua-2 (Microsoft) para otimização de contexto,
  redução de custos operacionais e diminuição de latência em modelos de linguagem.
---

# Token Compression Engine

Componente técnico para redução de densidade de tokens em prompts, utilizando o modelo XLM-RoBERTa (LLMLingua-2) para identificar e remover informações semanticamente redundantes preservando a integridade do contexto original.

## Arquitetura e Estrutura

O sistema é composto por scripts de inicialização, motor de compressão e ambiente isolado.

```
token-reduce/
├── SKILL.md          ← Documentação técnica e diretrizes
├── scripts/
│   ├── setup.py      ← Provisionamento de ambiente e modelos
│   └── compress.py   ← Lógica de processamento e compressão
└── .venv/            ← Ambiente virtual isolado (gerado localmente)
```

## Protocolo de Inicialização

A execução do motor requer um ambiente configurado localmente. O diretório `.venv` não faz parte da distribuição padrão.

### Procedimento de Setup:

1. Validar a existência do subdiretório `.venv`.
2. Caso ausente, executar o provisionamento técnico:

```bash
python "scripts/setup.py"
```

O processo de setup automatiza:
- Criação do ambiente virtual.
- Atualização do gerenciador de pacotes (pip).
- Instalação das dependências core (`llmlingua`).
- Download do modelo `microsoft/llmlingua-2-xlm-roberta-large-meetingbank` (~1.1 GB).

## Diretrizes de Operação

Após a inicialização, a compressão deve ser realizada utilizando o binário Python do ambiente virtual.

### Interface de Linha de Comando (CLI):

**Entrada via texto direto:**
```bash
.venv/Scripts/python scripts/compress.py --text "CONTEÚDO_PARA_COMPRESSÃO" --rate 0.4
```

**Processamento de arquivos:**
```bash
.venv/Scripts/python scripts/compress.py --file path/to/input.txt --rate 0.4 --output path/to/output.txt
```

**Saída estruturada (JSON) para integração:**
```bash
.venv/Scripts/python scripts/compress.py --file input.txt --rate 0.4 --json
```

## Configurações Técnicas

| Parâmetro      | Valor Padrão | Definição                                          |
|----------------|--------------|---------------------------------------------------|
| `--text`       | —            | Buffer de texto para processamento síncrono.      |
| `--file`       | —            | Path para leitura de dados persistidos.           |
| `--rate`       | `0.4`        | Coeficiente de retenção de tokens (0.0 a 1.0).    |
| `--output`     | —            | Path para persistência do resultado.               |
| `--json`       | `false`      | Flag para output em formato estruturado.          |

### Referência de Taxas de Retenção:

- `0.5`: Retenção conservadora. Recomendado para dados técnicos críticos.
- `0.4`: Equilíbrio otimizado. Padrão de eficiência para linguagem natural.
- `0.3`: Compressão moderada. Início de perda de detalhes estilísticos.
- `0.2`: Compressão agressiva. Foco exclusivo em núcleos semânticos.

## Especificações do Motor

O processo de compressão segue um pipeline de três camadas:

1. **Pre-processing Sanitization**:
   - Conversão de estruturas de tabelas Markdown para representações Key-Value estáveis.
   - Normalização de identificadores alfa-numéricos para proteção de tokens críticos.
   - Remoção de metadados de formatação redundantes (Markdown decoration).

2. **Semantic Scoring (LLMLingua-2)**:
   - Utilização do XLM-RoBERTa para atribuição de pesos de informação por token.
   - Aplicação de `force_tokens` para preservar sintaxe estrutural e operadores lógicos.

3. **Dynamic Chunking**:
   - Segmentação automática de volumes que excedam a janela de 512 tokens do modelo base.
   - Processamento paralelo/sequencial de blocos de 400 tokens para garantir consistência em documentos de alta escala.
 scoring degradado que ocorria em tokens apos a posicao 512.