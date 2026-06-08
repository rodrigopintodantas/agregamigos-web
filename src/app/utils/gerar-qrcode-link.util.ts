export async function gerarQrcodeDataUrl(texto: string, width = 280): Promise<string> {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(texto, {
    width,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}
