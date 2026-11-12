// app/api/nearby/route.ts
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")
  const type = searchParams.get("type")

  if (!lat || !lng || !type) {
    return NextResponse.json({ error: "Missing query params" }, { status: 400 })
  }

  const latitude = Number(lat)
  const longitude = Number(lng)
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !["pharmacies", "doctors"].includes(type)
  ) {
    return NextResponse.json({ error: "Invalid location or service type" }, { status: 400 })
  }

  const amenity = type === "pharmacies" ? "pharmacy" : "doctors"
  const radius = 3000 // meters

  const query = `[out:json];node[amenity=${amenity}](around:${radius},${latitude},${longitude});out;`

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      throw new Error(`Overpass API returned ${response.status}`)
    }
    const data = await response.json()

    const results = (data.elements || []).map((item: any) => ({
      name: item.tags?.name || "Unnamed",
      lat: item.lat,
      lng: item.lon,
    }))

    return NextResponse.json({ results })
  } catch (err) {
    console.error("Overpass API error:", err)
    return NextResponse.json({ error: "Failed to fetch nearby services" }, { status: 500 })
  }
}
