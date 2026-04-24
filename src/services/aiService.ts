import { GoogleGenAI, Type } from "@google/genai";
import { VariantQuestion } from "../types";

// Detect API Key from multiple potential environment sources in Vite
const getApiKey = () => {
  // Try Vite prefixed variable first (recommended for client-side)
  const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (viteKey) return viteKey;
  
  // Fallback to standard variable (may be available depending on build config)
  const processKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : null;
  if (processKey) return processKey;
  
  // Also try non-prefixed Vite variable if it exists
  const viteGeneric = (import.meta as any).env?.GEMINI_API_KEY;
  if (viteGeneric) return viteGeneric;

  return null;
};

const apiKey = getApiKey();

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not defined. Please add VITE_GEMINI_API_KEY to your environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export async function recognizeQuestion(base64Image: string): Promise<{ text: string, knowledgePoint: string }> {
  if (!apiKey) {
    throw new Error('MISSING_API_KEY: Please set VITE_GEMINI_API_KEY environment variable.');
  }
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image.split(',')[1] || base64Image
          }
        },
        {
          text: `您是一位专业的OCR与教育评估专家。请识别图片中的错题，并提取以下信息：
1. questionText: 完整的题目内容。如果是数学题，请保留所有公式和符号。
2. knowledgePoint: 包含【学段+科目+知识点】的详细描述。
   **注意（极重要）**：请严格根据【2024年新课程标准（新教材）】进行判定。例如，部分原属于三年级的知识点在新教材中已下沉至二年级，请以最新的教材划分为准。示例格式：“小学二年级下册数学-有余数的除法”。

请以JSON格式返回。如果题目文字模糊，请结合上下文逻辑进行合理推断补偿。`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questionText: { type: Type.STRING },
          knowledgePoint: { type: Type.STRING }
        },
        required: ["questionText", "knowledgePoint"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  return {
    text: result.questionText || "",
    knowledgePoint: result.knowledgePoint || "未知知识点"
  };
}

export async function generateVariants(originalText: string, knowledgePoint: string): Promise<VariantQuestion[]> {
  if (!apiKey) {
    throw new Error('MISSING_API_KEY: Please set VITE_GEMINI_API_KEY environment variable.');
  }
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `您是一位国家级特级教师，精通【2024年新版教材和新课标要求】，擅长根据错题进行“举一反三”的题目设计。

【原题背景】
知识点归属：${knowledgePoint}
原题内容：${originalText}

【生成任务】
请基于原题，生成3道高质量的变式练习题。

【核心要求 - 严禁违规】
1. **学段对标（极重要）**：必须严格遵循 [${knowledgePoint}] 中提到的学段。请务必结合【2024新教材改革】后的知识体系进行设计（例如，某些几何或计算要求在低年级已有所变化）。生成的题目难度、学段、逻辑复杂度必须与原题及最新大纲**严格保持一致**。
2. **变式多样**：覆盖同一知识点的不同应用场景或数字变式。
3. **逻辑自检**：每一道题在输出前，请您在后台完成一次模拟解题，确保题目逻辑通顺且答案解析无误。
4. **解析深度**：分析部分必须直指学生在处理该类变式时最容易产生的思维误区（易错点）。

【返回格式】
请以包含3个对象的JSON数组返回，每个对象包含：
- question (string): 题目正文
- answer (string): 简洁准确的答案
- analysis (string): 深刻的易错点剖析

请开始您的教学设计。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            answer: { type: Type.STRING },
            analysis: { type: Type.STRING }
          },
          required: ["question", "answer", "analysis"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
}
