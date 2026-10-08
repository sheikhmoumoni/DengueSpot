import { z } from "zod";
export interface OcrProvider {
  readText(
    image: Buffer,
    locale: string,
  ): Promise<{ text: string; locale: string; mock: boolean }>;
}
export class MockOcrProvider implements OcrProvider {
  async readText(_image: Buffer, locale: string) {
    return { text: "", locale, mock: true };
  }
}
export class GoogleVisionOcrProvider implements OcrProvider {
  constructor(private accessToken: () => Promise<string>) {}
  async readText(image: Buffer, locale: string) {
    const token = await this.accessToken();
    const response = await fetch(
      "https://vision.googleapis.com/v1/images:annotate",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          requests: [
            {
              image: { content: image.toString("base64") },
              features: [{ type: "TEXT_DETECTION" }],
              imageContext: { languageHints: ["bn"] },
            },
          ],
        }),
      },
    );
    if (!response.ok) throw new Error("Optional OCR provider failed");
    const result = z
      .object({
        responses: z.array(
          z
            .object({
              error: z.unknown().optional(),
              fullTextAnnotation: z.object({ text: z.string() }).optional(),
            })
            .passthrough(),
        ),
      })
      .parse(await response.json());
    if (result.responses[0]?.error)
      throw new Error("Optional OCR provider failed");
    return {
      text: result.responses[0]?.fullTextAnnotation?.text || "",
      locale,
      mock: false,
    };
  }
}
