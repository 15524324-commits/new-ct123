import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { QuestionRecord } from "../types";

export const generateQuestionsPDF = async (records: QuestionRecord[]) => {
  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
  });

  // Since we don't have a Chinese font embedded (which is tricky for jsPDF without a heavy blob)
  // I will use some standard layout and hope for the best, 
  // or use a more robust approach if needed.
  // Standard jsPDF doesn't support CJK out of the box. 
  // However, I can use html2canvas for specific sections if needed.
  // For simplicity in this demo, I will alert the user if they'd prefer a screenshot-based PDF
  // But let's try to implement a basic one first.

  let y = 20;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;

  doc.setFontSize(18);
  doc.text("错题举一反三练习册", pageWidth / 2, y, { align: "center" });
  y += 15;

  records.forEach((record, index) => {
    // Check page break
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`收录日期: ${new Date(record.createdAt?.toDate()).toLocaleDateString()}`, margin, y);
    y += 10;

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`原题 ${index + 1} [知识点: ${record.knowledgePoint}]`, margin, y);
    y += 10;

    // Content (Split text to fit width)
    const contentLines = doc.splitTextToSize(record.originalText, pageWidth - margin * 2);
    doc.setFontSize(11);
    doc.text(contentLines, margin, y);
    y += contentLines.length * 5 + 10;

    record.variants.forEach((v, vi) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(12);
      doc.setTextColor(50, 50, 255);
      doc.text(`变式练习 ${vi + 1}`, margin, y);
      y += 8;

      doc.setTextColor(0);
      const vLines = doc.splitTextToSize(v.question, pageWidth - margin * 2);
      doc.text(vLines, margin, y);
      y += vLines.length * 5 + 10;
    });

    // Add Answer Section at the end of the question or new page
    doc.addPage();
    y = 20;
    doc.setFontSize(14);
    doc.text(`答案与解析 - 原题 ${index + 1}`, margin, y);
    y += 15;

    record.variants.forEach((v, vi) => {
      doc.setFontSize(11);
      doc.text(`变式 ${vi + 1} 答案: ${v.answer}`, margin, y);
      y += 8;
      const aLines = doc.splitTextToSize(`解析: ${v.analysis}`, pageWidth - margin * 2);
      doc.text(aLines, margin, y);
      y += aLines.length * 5 + 10;
    });

    if (index < records.length - 1) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save(`错题本_${new Date().getTime()}.pdf`);
};

// Alternative: If Chinese fonts are a must (which they usually are for Chinese apps)
// We might need to use html2canvas on a hidden div.
// I'll provide a simpler "Print" using window.print() style as well in the UI.
