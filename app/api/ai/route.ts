import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildAiPrompt, getMockAiResponse } from "@/lib/ai";
import type { AiAction, Incident, IncidentMessage } from "@/lib/types";

type AiRequestBody = {
  action?: AiAction;
  incident?: Incident;
  messages?: IncidentMessage[];
};

function isAiAction(value: unknown): value is AiAction {
  return value === "summary" || value === "next_actions" || value === "customer_update";
}

function logAiSource(source: "openai" | "mock") {
  console.info(`AI source: ${source}`);
}

export async function POST(request: Request) {
  const body = (await request.json()) as AiRequestBody;

  if (!isAiAction(body.action) || !body.incident) {
    return NextResponse.json(
      { error: "action and incident are required." },
      { status: 400 }
    );
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const apiKey = process.env.OPENAI_API_KEY;
  const mockText = getMockAiResponse(body.action, body.incident);

  if (!apiKey) {
    logAiSource("mock");
    return NextResponse.json({ text: mockText, source: "mock", usedMock: true });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: buildAiPrompt(body.action, body.incident, messages),
      max_output_tokens: 500,
    });

    const text = response.output_text?.trim() ?? "";

    if (!text) {
      logAiSource("mock");
      return NextResponse.json({
        text: mockText,
        source: "mock",
        usedMock: true,
        warning: "OpenAI returned no text; returned deterministic mock output.",
      });
    }

    logAiSource("openai");
    return NextResponse.json({
      text,
      source: "openai",
      usedMock: false,
    });
  } catch {
    logAiSource("mock");
    return NextResponse.json({
      text: mockText,
      source: "mock",
      usedMock: true,
      warning: "OpenAI request failed; returned deterministic mock output.",
    });
  }
}
