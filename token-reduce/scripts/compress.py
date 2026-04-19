"""
compress.py — Motor de compressão de tokens para otimização de contexto de LLMs.
Implementa LLMLingua-2 (Microsoft) com sanitização de Markdown e chunking dinâmico.
"""

import argparse
import json as json_mod
import re
import sys
import logging
from pathlib import Path

# Configuração de Logging Profissional
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("token-reduce")

SKILL_DIR = Path(__file__).parent.parent
VENV_DIR = SKILL_DIR / ".venv"

# -- Verificação de Ambiente ---------------------------------------------------

def check_environment():
    """Valida a integridade do ambiente virtual."""
    venv_python = VENV_DIR / "Scripts" / "python.exe"
    if not venv_python.exists():
        venv_python = VENV_DIR / "bin" / "python"

    if not VENV_DIR.exists() or not venv_python.exists():
        logger.error("Ambiente virtual (.venv) não localizado.")
        print(f"Execute o provisionamento inicial: python \"{SKILL_DIR / 'scripts' / 'setup.py'}\"",
              file=sys.stderr)
        sys.exit(1)

    if sys.prefix == sys.base_prefix:
        logger.error("Execução fora do ambiente virtual detectada.")
        print(f"Utilize o binário do venv: \"{venv_python}\" \"{__file__}\" [args]",
              file=sys.stderr)
        sys.exit(1)


# -- Motor de Compressão -------------------------------------------------------

def detect_device() -> str:
    """Auto-detecção de suporte a hardware acelerado (CUDA)."""
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
    except ImportError:
        pass
    return "cpu"


MODEL_NAME = "microsoft/llmlingua-2-xlm-roberta-large-meetingbank"
CHUNK_MAX_TOKENS = 400

# Parâmetros de preservação estrutural
COMPRESS_KWARGS = dict(
    force_tokens=[
        "\n", ".", ",", "?", "!", ":", ";",
        "não", "sem", "nenhum", "nunca", "nem", "nenhuma",
        "Must", "must", "Obrigatória", "obrigatória",
        "npm", "run", "dev",
        "retry", "fallback", "timeout", "WAL",
        "baseline", "target", "Baseline", "Target",
        "`",
    ],
    force_reserve_digit=True,
    drop_consecutive=True,
)


def load_compressor():
    from llmlingua import PromptCompressor
    device = detect_device()
    logger.info(f"Inicializando PromptCompressor (Hardware: {device.upper()})")
    return PromptCompressor(
        model_name=MODEL_NAME,
        use_llmlingua2=True,
        device_map=device,
    )


def load_tokenizer():
    from transformers import AutoTokenizer
    return AutoTokenizer.from_pretrained(MODEL_NAME)


# -- Sanitização e Pré-processamento ------------------------------------------

def tables_to_keyvalue(text: str) -> str:
    """Conversão de estruturas tabulares para representações lineares estáveis."""
    lines = text.split('\n')
    result = []
    i = 0
    while i < len(lines):
        if lines[i].strip().startswith('|') and '|' in lines[i][1:]:
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                table_lines.append(lines[i])
                i += 1
            if len(table_lines) < 2:
                result.extend(table_lines)
                continue
            headers = [h.strip() for h in table_lines[0].split('|')[1:-1]]
            for tl in table_lines[1:]:
                if re.match(r'^\s*\|[-:\s|]+\|\s*$', tl):
                    continue
                values = [v.strip() for v in tl.split('|')[1:-1]]
                for h, v in zip(headers, values):
                    if v:
                        result.append(f"{h}: {v}")
                result.append('')
        else:
            result.append(lines[i])
            i += 1
    return '\n'.join(result)


def normalize_identifiers(text: str) -> str:
    """Proteção de identificadores alfa-numéricos técnicos via normalização."""
    return re.sub(r'\b(G|RF|RNF|NG|EC)-(\d+)', r'\1\2', text)


def strip_markdown(text: str) -> str:
    """Remoção de artefatos de redundância visual do Markdown."""
    text = re.sub(r'^---+\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'- \[[ x]\]\s*', '', text)
    text = re.sub(r'^```\w*\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


# -- Processamento Dinâmico ----------------------------------------------------

def split_into_chunks(text: str, tokenizer, max_tokens: int = CHUNK_MAX_TOKENS) -> list[str]:
    """Fragmentação inteligente baseada em limites de linhas e tokens."""
    lines = text.split('\n')
    chunks = []
    current_lines = []
    current_tokens = 0

    for line in lines:
        line_tokens = len(tokenizer.encode(line, add_special_tokens=False))
        if current_tokens + line_tokens > max_tokens and current_lines:
            chunks.append('\n'.join(current_lines))
            current_lines = []
            current_tokens = 0
        current_lines.append(line)
        current_tokens += line_tokens

    if current_lines:
        chunks.append('\n'.join(current_lines))

    return chunks


def compress(text: str, rate: float) -> dict:
    """Pipeline principal de compressão semântica."""
    text = tables_to_keyvalue(text)
    text = normalize_identifiers(text)
    text = strip_markdown(text)
    
    compressor = load_compressor()
    tokenizer = load_tokenizer()

    chunks = split_into_chunks(text, tokenizer)

    if len(chunks) == 1:
        result = compressor.compress_prompt(text, rate=rate, **COMPRESS_KWARGS)
        return {
            "compressed_prompt": result["compressed_prompt"],
            "origin_tokens": result["origin_tokens"],
            "compressed_tokens": result["compressed_tokens"],
            "ratio": round(float(str(result["ratio"]).rstrip("x")), 2),
            "saving": result["origin_tokens"] - result["compressed_tokens"],
            "rate_requested": rate,
        }

    logger.info(f"Documento segmentado em {len(chunks)} fragmentos para processamento.")

    compressed_parts = []
    total_origin = 0
    total_compressed = 0

    for i, chunk in enumerate(chunks, 1):
        r = compressor.compress_prompt(chunk, rate=rate, **COMPRESS_KWARGS)
        compressed_parts.append(r["compressed_prompt"])
        total_origin += r["origin_tokens"]
        total_compressed += r["compressed_tokens"]
        logger.debug(f"Processamento parcial ({i}/{len(chunks)}): {r['origin_tokens']} -> {r['compressed_tokens']} tokens")

    ratio = round(total_origin / total_compressed, 2) if total_compressed > 0 else 0.0

    return {
        "compressed_prompt": "\n".join(compressed_parts),
        "origin_tokens": total_origin,
        "compressed_tokens": total_compressed,
        "ratio": ratio,
        "saving": total_origin - total_compressed,
        "rate_requested": rate,
    }


# -- Interface CLI -------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(
        description="Token Compression Engine — LLMLingua-2 (Agnóstico)"
    )
    # Buffers de Entrada
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument("--text", help="Entrada via string direta.")
    group.add_argument("--file", help="Entrada via system path.")

    # Parâmetros Operacionais
    p.add_argument("--rate", type=float, default=0.4,
                   help="Coeficiente de retenção de tokens (Default: 0.4).")

    # Outputs
    p.add_argument("--output", "-o", help="Persistência do resultado em arquivo customizado.")
    p.add_argument("--json", action="store_true",
                   help="Formatação do output em estrutura JSON.")
    
    p.add_argument("--verbose", action="store_true", help="Habilitar logs de depuração.")

    return p.parse_args()


def main():
    check_environment()
    args = parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    # Ingestão de Dados
    if args.file:
        path = Path(args.file)
        if not path.exists():
            logger.error(f"Arquivo não localizado: {path}")
            sys.exit(1)
        text = path.read_text(encoding="utf-8")
    else:
        text = args.text

    if not text.strip():
        logger.error("Fluxo de entrada vazio detectado.")
        sys.exit(1)

    # Execução do Core
    try:
        result = compress(text, args.rate)
    except Exception as e:
        logger.error(f"Falha crítica no motor de compressão: {e}")
        sys.exit(1)

    # Persistência
    if args.output:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(result["compressed_prompt"], encoding="utf-8")
        logger.info(f"Sucesso: Resultado persistido em {out.resolve()}")

    # Output Pipeline
    if args.json:
        output = { "compression": result }
        print(json_mod.dumps(output, ensure_ascii=False, indent=2))
    else:
        print("\n" + "="*40)
        print(" ESTATÍSTICAS DE COMPRESSÃO")
        print("="*40)
        print(f"Tokens Originais:    {result['origin_tokens']}")
        print(f"Tokens Retidos:      {result['compressed_tokens']}")
        print(f"Fator de Eficiência: {result['ratio']}x")
        print(f"Economia Bruta:      {result['saving']} tokens")
        print("="*40)

        if not args.output:
            print(f"\n[TEXTO COMPRIMIDO]\n")
            print(result["compressed_prompt"])
            print("\n" + "-"*40)


if __name__ == "__main__":
    main()
