import { NextRequest, NextResponse } from "next/server"

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent"

type RequestBody = {
  action?: string
  message?: string
  symptoms?: string
  age?: number
  imageData?: string
  mimeType?: string
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getResponseText(data: unknown) {
  const result = data as GeminiResponse
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("The AI service returned an empty response")
  }
  return text.trim()
}

function parseJsonResponse(text: string): Record<string, unknown> {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end < start) {
    throw new Error("The AI service returned an invalid response")
  }
  const parsed: unknown = JSON.parse(text.slice(start, end + 1))
  if (!isRecord(parsed)) {
    throw new Error("The AI service returned an invalid response")
  }
  return parsed
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

async function generateContent(apiKey: string, parts: object[], temperature: number) {
  const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature, topK: 40, topP: 0.95, maxOutputTokens: 1024 },
    }),
  })

  if (!response.ok) {
    console.error("Gemini request failed with status", response.status)
    throw new Error("The AI service is temporarily unavailable")
  }

  return getResponseText(await response.json())
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "AI service is not configured" }, { status: 503 })
  }

  let parsedBody: unknown
  try {
    parsedBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
  }
  if (!isRecord(parsedBody)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const body = parsedBody as RequestBody

  try {
    if (body.action === "chat") {
      if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 4000) {
        return NextResponse.json({ error: "A message of 1 to 4000 characters is required" }, { status: 400 })
      }

      const text = await generateContent(
        apiKey,
        [{
          text: `You are a health information assistant, not a medical professional. Give general, cautious information, do not diagnose or prescribe, and advise consulting a qualified healthcare professional. Direct emergencies to local emergency services. User question: ${body.message}`,
        }],
        0.7,
      )
      return NextResponse.json({ response: text })
    }

    if (body.action === "symptoms") {
      if (typeof body.symptoms !== "string" || !body.symptoms.trim() || body.symptoms.length > 4000) {
        return NextResponse.json({ error: "Symptoms of 1 to 4000 characters are required" }, { status: 400 })
      }
      const age =
        typeof body.age === "number" && Number.isInteger(body.age) && body.age > 0 && body.age <= 120
          ? ` Age: ${body.age}.`
          : ""
      const text = await generateContent(
        apiKey,
        [{
          text: `Provide general self-care information for these symptoms: ${body.symptoms}.${age} Do not diagnose or prescribe medicines. Mention urgent warning signs and recommend professional care when appropriate. Return only JSON with string arrays "recommendedMedicines", "possibleConditions", and "selfCareAdvice". For recommendedMedicines, only provide general categories or say to consult a clinician; do not provide individualized medication instructions.`,
        }],
        0.3,
      )
      const result = parseJsonResponse(text)
      return NextResponse.json({
        recommendedMedicines: stringArray(result.recommendedMedicines),
        possibleConditions: stringArray(result.possibleConditions),
        selfCareAdvice: stringArray(result.selfCareAdvice),
      })
    }

    if (body.action === "extractMedicineInfo") {
      const supportedTypes = ["image/jpeg", "image/png", "image/webp"]
      if (
        typeof body.imageData !== "string" ||
        body.imageData.length === 0 ||
        body.imageData.length > 10_000_000 ||
        !supportedTypes.includes(body.mimeType || "")
      ) {
        return NextResponse.json({ error: "A supported image under 10 MB is required" }, { status: 400 })
      }

      const text = await generateContent(
        apiKey,
        [
          {
            text: 'Read only visible information from the medicine package. Do not infer missing values. Return JSON with string properties "name", "dosage", "expiryDate" (YYYY-MM-DD when legible), "manufacturer", and "quantity". Use "Not specified" for unreadable fields.',
          },
          {
            inline_data: { mime_type: body.mimeType, data: body.imageData },
          },
        ],
        0.1,
      )
      const result = parseJsonResponse(text)
      const fields = ["name", "dosage", "expiryDate", "manufacturer", "quantity"] as const
      return NextResponse.json(
        Object.fromEntries(fields.map((field) => [field, typeof result[field] === "string" ? result[field] : "Not specified"])),
      )
    }

    return NextResponse.json({ error: "Unsupported AI action" }, { status: 400 })
  } catch (error) {
    console.error("AI request failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The AI service is temporarily unavailable" },
      { status: 502 },
    )
  }
}
