export type TranspositionPdf = {
  original: string[];
  result: string[];
  fromLabel: string;
  toLabel: string;
  fromTuning: string;
  toTuning: string;
  interval: string;
  folder?: string;
};

const pretty = (note: string) => note.replace("#", "♯").replace("b", "♭");

/** Gera o PDF da transposição no navegador e dispara o download. */
export async function exportTranspositionPdf(data: TranspositionPdf): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFillColor(15, 17, 23);
  doc.rect(0, 0, 595, 130, "F");
  doc.setTextColor(217, 178, 90);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("Octava", 48, 62);
  doc.setTextColor(240, 240, 245);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Transposicao para partitura", 48, 86);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleDateString("pt-BR"), 48, 106);

  let y = 170;
  doc.setTextColor(110, 110, 120);
  doc.setFontSize(11);
  doc.text(`Origem  ${data.fromLabel} (${data.fromTuning})`, 48, y);
  y += 22;
  doc.setTextColor(30, 30, 35);
  doc.setFontSize(16);
  doc.text(data.original.map(pretty).join("   "), 48, y);

  y += 46;
  doc.setTextColor(110, 110, 120);
  doc.setFontSize(11);
  doc.text(`Destino  ${data.toLabel} (${data.toTuning})  -  ${data.interval}`, 48, y);
  y += 22;
  doc.setTextColor(20, 120, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(data.result.map(pretty).join("   "), 48, y);

  if (data.folder) {
    y += 40;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 150);
    doc.setFontSize(10);
    doc.text(`Pasta: ${data.folder}`, 48, y);
  }

  doc.save(`octava-${data.result.join("-").replace(/[#b]/g, "")}.pdf`);
}
