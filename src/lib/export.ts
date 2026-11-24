import type Konva from "konva";

/** Download the stage as it currently looks (pan, zoom and every layer) at 2x resolution. */
export function exportStagePng(stage: Konva.Stage, filename: string) {
  const url = stage.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
