// --- Leitura de arquivo local → base64 (string pura, sem o prefixo data:) ---
// Extraído de useDocumentParser (parser de patrimônio) para ser compartilhado
// com o import de consumo jurídico. SÓ a leitura File→base64 é comum entre os
// consumidores; a chamada ao claude-proxy e o prompt ficam LOCAIS em cada um
// (duplicação consciente — divergem por natureza).

/** Lê um File e resolve para a string base64 pura (sem o prefixo
 *  `data:<mime>;base64,`). Rejeita em erro de leitura. */
export function lerArquivoBase64(arquivo: File): Promise<string> {
  return new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(arquivo);
  });
}
