import { memberLabel, SHEET, sheetRows, type Formation } from "./formation";

export async function formationImage(formation: Formation, showJobs = false): Promise<Blob> {
  await document.fonts.ready;
  const rows = sheetRows(formation);
  const width = SHEET.columnWidth * 8;
  const height = SHEET.headerHeight + SHEET.rowHeight * rows;
  const canvas = document.createElement("canvas");
  canvas.width = (width + 1) * 2;
  canvas.height = (height + 1) * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 만들 수 없습니다.");
  ctx.scale(2, 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width + 1, height + 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let party = 0; party < 4; party++) {
    const x = party * SHEET.columnWidth * 2;
    ctx.fillStyle = SHEET.colors[party];
    ctx.fillRect(x, 0, SHEET.columnWidth * 2, SHEET.headerHeight);
    ctx.fillStyle = "#2C3E50";
    ctx.font = `bold ${11 * 4 / 3}px ${SHEET.font}`;
    ctx.fillText(SHEET.names[party], x + SHEET.columnWidth, 10);
    ctx.fillText(`(${formation.parties[party].filter(Boolean).length}명)`, x + SHEET.columnWidth, 26);
    ctx.font = `${10 * 4 / 3}px ${SHEET.font}`;
    ctx.fillStyle = "#000000";
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < 2; column++) {
        const member = formation.parties[party][row * 2 + column];
        if (!member) continue;
        const label = memberLabel(member, showJobs);
        ctx.font = `${10 * 4 / 3}px ${SHEET.font}`;
        const textWidth = ctx.measureText(label).width;
        if (textWidth > SHEET.columnWidth - 6) {
          ctx.font = `${(10 * 4 / 3) * (SHEET.columnWidth - 6) / textWidth}px ${SHEET.font}`;
        }
        const left = x + column * SHEET.columnWidth;
        ctx.save();
        ctx.beginPath();
        ctx.rect(left + 3, SHEET.headerHeight + row * SHEET.rowHeight, SHEET.columnWidth - 6, SHEET.rowHeight);
        ctx.clip();
        ctx.fillText(label, left + SHEET.columnWidth / 2, SHEET.headerHeight + (row + 0.5) * SHEET.rowHeight);
        ctx.restore();
      }
    }
  }
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let column = 0; column <= 8; column++) {
    const x = column * SHEET.columnWidth + 0.5;
    ctx.moveTo(x, column % 2 === 0 ? 0 : SHEET.headerHeight);
    ctx.lineTo(x, height);
  }
  ctx.moveTo(0, 0.5);
  ctx.lineTo(width, 0.5);
  for (let row = 0; row <= rows; row++) {
    const y = SHEET.headerHeight + row * SHEET.rowHeight + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  return new Promise((resolve, reject) => canvas.toBlob((blob) =>
    blob ? resolve(blob) : reject(new Error("이미지를 만들 수 없습니다.")), "image/png"));
}
