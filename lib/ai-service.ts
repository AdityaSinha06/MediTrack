export type MedicineInfo = {
  name: string
  dosage: string
  expiryDate: string
  manufacturer: string
  quantity: string
}

type SymptomAnalysis = {
  recommendedMedicines: string[]
  possibleConditions: string[]
  selfCareAdvice: string[]
}

async function requestAi<T>(payload: object): Promise<T> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.error || "The AI service is temporarily unavailable")
  }
  return result as T
}

export const aiService = {
  async generateChatResponse(userInput: string): Promise<string> {
    const result = await requestAi<{ response: string }>({ action: "chat", message: userInput })
    return result.response
  },

  async analyzeSymptoms(symptoms: string, age?: number): Promise<SymptomAnalysis> {
    return requestAi<SymptomAnalysis>({ action: "symptoms", symptoms, age })
  },

  async extractMedicineInfo(imageData: string, mimeType = "image/jpeg"): Promise<MedicineInfo> {
    return requestAi<MedicineInfo>({ action: "extractMedicineInfo", imageData, mimeType })
  },
}
