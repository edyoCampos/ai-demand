/**
 * WikiSanitizer - Camada de Segurança de Persistência.
 * Garante que fatos extraídos pela IA não contenham comandos ou instruções maliciosas.
 */
export class WikiSanitizer {
  // Padrões de Injeção de Prompt
  private static FORBIDDEN_PATTERNS = [
    /ignore as instruções/gi,
    /delete all/gi,
    /delete todos/gi,
    /format c:/gi,
    /rm -rf/gi,
    /drop table/gi,
    /truncate/gi
  ];

  // Padrões de Identificação de Sistema Interno
  private static INTERNAL_SYSTEM_PATTERNS = [
    /DemandAI/gi,
    /WikiEngine/gi,
    /Kernel/gi,
    /CapabilityRegistry/gi,
    /MemoryPersistence/gi,
    /PersistenceAdapter/gi,
    /ProviderFactory/gi,
    /EventBus/gi,
    /Orchestration/gi
  ];

  /**
   * Sanitiza o conteúdo de um verbete para evitar injeção de prompt
   * e vazamento de informações internas do sistema.
   */
  public static sanitize(content: string): string {
    const lines = content.split('\n');
    
    // 1. Verifica Injeção de Prompt em todo o bloco
    for (const pattern of this.FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) return '';
    }

    // 2. Verifica Padrões Internos em todo o bloco
    for (const pattern of this.INTERNAL_SYSTEM_PATTERNS) {
      if (pattern.test(content)) {
        console.warn(`[WikiSanitizer] Bloqueado padrão de sistema interno: ${pattern}`);
        return '';
      }
    }

    return content.trim();
  }

  /**
   * Valida se o título do verbete é puramente nominal e técnico.
   */
  public static sanitizeTitle(title: string): string {
    // Bloqueia termos de sistema no título
    for (const pattern of this.INTERNAL_SYSTEM_PATTERNS) {
      if (pattern.test(title)) return '';
    }
    
    // Remove caracteres especiais que podem ser usados para path traversal ou escape de markdown
    return title.replace(/[\\/:*?"<>|#]/g, '').trim();
  }
}
