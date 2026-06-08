export function normalizarCabecalhoCsv(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function ehColunaTelefoneCsv(header: string): boolean {
  const h = normalizarCabecalhoCsv(header);
  if (!h || h.includes('instagram')) return false;
  if (h.includes('email') || h.includes('e mail')) return false;
  if (h.includes('telefone') || h.includes('whatsapp') || h.includes('celular')) return true;
  if (h === 'fone' || (h.includes('fone') && !h.includes('microfone'))) return true;
  return false;
}

export function possuiColunaNomeCsv(headers: string[]): boolean {
  const aliases = new Set(['nome completo', 'nome', 'nomecompleto']);
  return headers.some((header) => aliases.has(header.replace(/\s+/g, ' ').trim()));
}

export function possuiColunaTelefoneCsv(headers: string[]): boolean {
  return headers.some((header) => ehColunaTelefoneCsv(header));
}

function sanitizarCabecalhoCsv(value: string): string {
  return String(value ?? '')
    .replace(/^\uFEFF/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function parseCsvLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === separator && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export function parseCsvPessoa(content: string): Record<string, string>[] {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return [];

  const tabCount = lines[0].match(/\t/g)?.length ?? 0;
  const semicolonCount = lines[0].match(/;/g)?.length ?? 0;
  const commaCount = lines[0].match(/,/g)?.length ?? 0;
  const separator =
    tabCount >= semicolonCount && tabCount >= commaCount ? '\t' : semicolonCount > commaCount ? ';' : ',';
  const headers = parseCsvLine(lines[0], separator).map((h) => sanitizarCabecalhoCsv(h));

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, separator);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

export function prepararTelefonesCsv(registros: Record<string, string>[]): void {
  registros.forEach((row) => {
    for (const key of Object.keys(row)) {
      if (ehColunaTelefoneCsv(key)) {
        row[key] = (row[key] ?? '').replace(/\D/g, '');
      }
    }
  });
}

export async function lerArquivoTextoCsv(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!utf8.includes('\uFFFD')) return utf8;
  return new TextDecoder('windows-1252').decode(buffer);
}
