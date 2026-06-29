/**
 * Advanced AI engine for NGO impact reporting.
 * Supports Groq, Gemini, and OpenAI with structured JSON + narrative modes.
 */

export type AiProvider = "groq" | "gemini" | "openai" | "template";

export interface AiEngineConfig {
  provider: AiProvider;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiChatOptions {
  messages: AiChatMessage[];
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface AiChatResult {
  content: string;
  provider: AiProvider;
  model: string;
}

const NGO_SYSTEM_PROMPT = `You are an expert NGO impact analyst and report writer for Indian nonprofits.
You understand logframe theory: Inputs → Activities → Outputs → Outcomes → Impact.
Write factual, donor-ready prose. Never invent statistics — only use numbers from the data provided.
Use professional language suitable for boards, funders, and government partners.`;

function envProvider(): AiProvider | null {
  const forced = process.env.AI_ENGINE_PROVIDER?.toLowerCase();
  if (forced === "groq" || forced === "gemini" || forced === "openai") return forced;
  return null;
}

export function resolveAiEngine(): AiEngineConfig {
  const forced = envProvider();
  if (forced === "openai" && process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.35,
      maxTokens: 4000,
    };
  }
  if (forced === "gemini" && process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
      temperature: 0.35,
      maxTokens: 4000,
    };
  }
  if (forced === "groq" && process.env.GROQ_API_KEY) {
    return {
      provider: "groq",
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      temperature: 0.35,
      maxTokens: 4000,
    };
  }

  // Auto-detect best available (OpenAI → Groq → Gemini)
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.35,
      maxTokens: 4000,
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      provider: "groq",
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      temperature: 0.35,
      maxTokens: 4000,
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
      temperature: 0.35,
      maxTokens: 4000,
    };
  }

  return { provider: "template", model: "builtin", temperature: 0, maxTokens: 0 };
}

async function callOpenAi(
  config: AiEngineConfig,
  options: AiChatOptions
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: options.messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens ?? config.maxTokens,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

async function callGroq(config: AiEngineConfig, options: AiChatOptions): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: options.messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens ?? config.maxTokens,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[Groq API]", res.status, errText.slice(0, 200));
    return null;
  }
  try {
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

async function callGemini(config: AiEngineConfig, options: AiChatOptions): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const systemMsg = options.messages.find((m) => m.role === "system")?.content ?? NGO_SYSTEM_PROMPT;
  const userMsgs = options.messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
    .join("\n\n");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemMsg }] },
        contents: [{ parts: [{ text: userMsgs }] }],
        generationConfig: {
          temperature: options.temperature ?? config.temperature,
          maxOutputTokens: options.maxTokens ?? config.maxTokens,
          ...(options.jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }
  );

  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}

export async function callAiEngine(options: AiChatOptions): Promise<AiChatResult | null> {
  const config = resolveAiEngine();
  if (config.provider === "template") return null;

  let content: string | null = null;
  switch (config.provider) {
    case "openai":
      content = await callOpenAi(config, options);
      break;
    case "groq":
      content = await callGroq(config, options);
      break;
    case "gemini":
      content = await callGemini(config, options);
      break;
  }

  if (!content) return null;
  return { content, provider: config.provider, model: config.model };
}

/** Structured impact analysis returned by the AI engine (stage 1). */
export interface ImpactAnalysisJson {
  executiveSummary: string;
  inputs: string;
  outputs: string;
  outcomes: string;
  insights: string[];
  impact: string;
  sdgContribution: string;
  lessonsLearned: string;
  programActivities: string;
  beneficiaryImpact: string;
  kpiProgress: string;
  financialHighlights?: string;
  recommendations: string;
}

export function parseImpactAnalysisJson(raw: string): ImpactAnalysisJson | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(cleaned) as Partial<ImpactAnalysisJson>;
    if (!parsed.executiveSummary || !Array.isArray(parsed.insights)) return null;
    return {
      executiveSummary: String(parsed.executiveSummary),
      inputs: String(parsed.inputs ?? ""),
      outputs: String(parsed.outputs ?? ""),
      outcomes: String(parsed.outcomes ?? ""),
      insights: parsed.insights.map(String),
      impact: String(parsed.impact ?? ""),
      sdgContribution: String(parsed.sdgContribution ?? ""),
      lessonsLearned: String(parsed.lessonsLearned ?? ""),
      programActivities: String(parsed.programActivities ?? ""),
      beneficiaryImpact: String(parsed.beneficiaryImpact ?? ""),
      kpiProgress: String(parsed.kpiProgress ?? ""),
      financialHighlights: parsed.financialHighlights ? String(parsed.financialHighlights) : undefined,
      recommendations: String(parsed.recommendations ?? ""),
    };
  } catch {
    return null;
  }
}

const IMPACT_JSON_SCHEMA = `{
  "executiveSummary": "2-3 paragraphs",
  "inputs": "2 paragraphs on resources deployed (staff, volunteers, funds, infrastructure)",
  "outputs": "2 paragraphs on direct deliverables (activities completed, services delivered, people reached)",
  "outcomes": "2 paragraphs on measurable changes (KPI attainment, service completion, behavior shifts)",
  "insights": ["5-8 bullet insights with specific numbers from the data"],
  "impact": "2 paragraphs on sustainable long-term change and community benefit",
  "sdgContribution": "1-2 paragraphs linking work to SDG goals",
  "lessonsLearned": "1-2 paragraphs on what worked and what to improve",
  "programActivities": "2 paragraphs on field operations",
  "beneficiaryImpact": "2 paragraphs on beneficiary outcomes",
  "kpiProgress": "1-2 paragraphs on milestone progress",
  "financialHighlights": "1-2 paragraphs (omit key if no finance data)",
  "recommendations": "4-6 actionable recommendations as prose paragraph"
}`;

export async function generateImpactAnalysis(
  dataContext: string
): Promise<{ analysis: ImpactAnalysisJson; provider: AiProvider; model: string } | null> {
  const result = await callAiEngine({
    jsonMode: true,
    messages: [
      { role: "system", content: NGO_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze this NGO program data and return a JSON object matching this schema exactly:
${IMPACT_JSON_SCHEMA}

Use ONLY facts from the data. Every insight must cite a number. Indian NGO context.

DATA:
${dataContext}`,
      },
    ],
  });

  if (!result) return null;
  const analysis = parseImpactAnalysisJson(result.content);
  if (!analysis) return null;
  return { analysis, provider: result.provider, model: result.model };
}

export async function polishImpactNarrative(
  sections: ImpactAnalysisJson,
  dataContext: string
): Promise<{ narrative: string; provider: AiProvider; model: string } | null> {
  const result = await callAiEngine({
    messages: [
      { role: "system", content: NGO_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Convert this structured impact analysis into a polished markdown report for donors and boards.
Use ## headings for each section. Write rich multi-paragraph prose (not bullet lists except for Key Insights).
Include a ## Key Insights section with bullet points from the insights array.

SECTIONS (expand with connective narrative, keep all numbers accurate):
${JSON.stringify(sections, null, 2)}

Original data reference:
${dataContext.slice(0, 2000)}

Required markdown sections in order:
# NGO Impact Report
## Executive Summary
## Inputs & Resources Deployed
## Program Activities
## Outputs & Deliverables
## Outcomes & Measurable Change
## Beneficiary Impact
## KPI & Milestone Progress
## Key Insights
## Long-term Impact
## SDG Contribution
## Lessons Learned
## Financial Highlights (only if financialHighlights present)
## Recommendations

Under 1500 words. Professional tone.`,
      },
    ],
    maxTokens: 4500,
  });

  if (!result) return null;
  return { narrative: result.content, provider: result.provider, model: result.model };
}

export function getAiEngineLabel(provider: AiProvider, model?: string): string {
  switch (provider) {
    case "openai":
      return `OpenAI (${model ?? "gpt-4o-mini"})`;
    case "groq":
      return `Groq (${model ?? "Llama 3.3 70B"})`;
    case "gemini":
      return `Google Gemini (${model ?? "2.0 Flash"})`;
    default:
      return "Built-in template (set OPENAI_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY)";
  }
}
