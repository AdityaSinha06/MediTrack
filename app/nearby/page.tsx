"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MapPinIcon,
  SearchIcon,
  PhoneIcon,
  ClockIcon,
  NavigationIcon,
  Loader2Icon,
} from "lucide-react"
import { PageShell } from "@/components/page-shell"

type Service = {
  id: number
  name: string
  address: string
  phone: string
  distance: number
  hours: string
}

function distanceInMiles(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDifference = radians(toLat - fromLat)
  const longitudeDifference = radians(toLng - fromLng)
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(radians(fromLat)) * Math.cos(radians(toLat)) * Math.sin(longitudeDifference / 2) ** 2
  return 3958.8 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export default function NearbyPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("distance")
  const [isLoading, setIsLoading] = useState(true)
  const [locationError, setLocationError] = useState("")
  const [pharmacies, setPharmacies] = useState<Service[]>([])
  const [doctors, setDoctors] = useState<Service[]>([])

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Location access is not available in this browser.")
      setIsLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude

      const radius = 3000 // in meters

      const overpassOrQuery = (filters: { key: string; value: string }[]) => {
        const queryParts = filters.map(f => `
          node["${f.key}"="${f.value}"](around:${radius},${lat},${lng});
          way["${f.key}"="${f.value}"](around:${radius},${lat},${lng});
          relation["${f.key}"="${f.value}"](around:${radius},${lat},${lng});
        `).join("\n")

        return `
          [out:json][timeout:25];
          (
            ${queryParts}
          );
          out center;
        `
      }

      const fetchOverpassData = async (query: string) => {
        const response = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: query,
        })
        if (!response.ok) {
          throw new Error(`Nearby services request failed (${response.status})`)
        }
        const data = await response.json()

        return (data.elements || []).map((el: any) => {
          const serviceLat = el.lat ?? el.center?.lat
          const serviceLng = el.lon ?? el.center?.lon
          return {
            id: el.id,
            name: el.tags?.name || "Unnamed",
            address: el.tags?.["addr:full"] || el.tags?.["addr:street"] || "Address not available",
            phone: el.tags?.["phone"] || el.tags?.["contact:phone"] || "Phone not available",
            distance:
              typeof serviceLat === "number" && typeof serviceLng === "number"
                ? distanceInMiles(lat, lng, serviceLat, serviceLng)
                : 0,
            hours: el.tags?.["opening_hours"] || "Opening hours not available",
          }
        })
      }

      try {
        const pharmacyQuery = overpassOrQuery([
          { key: "amenity", value: "pharmacy" },
          { key: "shop", value: "chemist" },
          { key: "healthcare", value: "pharmacy" },
          { key: "healthcare", value: "Medical-Shop" },
          { key: "shop", value: "Medical-shop" },
          { key: "healthcare", value: "Homeopathy" },
        ])

        const doctorQuery = overpassOrQuery([
          { key: "amenity", value: "doctors" },
          { key: "healthcare", value: "doctor" },
        ])

        const [pharmacyResults, doctorResults] = await Promise.all([
          fetchOverpassData(pharmacyQuery),
          fetchOverpassData(doctorQuery),
        ])

        setPharmacies(pharmacyResults)
        setDoctors(doctorResults)
      } catch (err) {
        console.error("Error fetching from Overpass API:", err)
        setLocationError("Could not load nearby services. Please try again later.")
        setPharmacies([])
        setDoctors([])
      }

      setIsLoading(false)
    }, () => {
      setLocationError("Unable to get your location. Allow location access and refresh the page.")
      setIsLoading(false)
    }, { timeout: 10000 })
  }, [])

  const filteredPharmacies = pharmacies
    .filter((pharmacy) =>
      pharmacy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pharmacy.address.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => filterType === "distance" ? a.distance - b.distance : a.name.localeCompare(b.name))

  const filteredDoctors = doctors
    .filter((doctor) =>
      doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.address.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => filterType === "distance" ? a.distance - b.distance : a.name.localeCompare(b.name))

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-emerald-200">Local network</p>
          <h1 className="text-4xl font-semibold text-white">Nearby Healthcare Services</h1>
          <p className="text-white/70">
            Find pharmacies and doctors around you, sorted by distance or name.
          </p>
        </div>
        {locationError && <p className="text-sm text-amber-200">{locationError}</p>}

        {isLoading ? (
          <Card className="flex items-center justify-center p-12">
            <div className="text-center">
              <Loader2Icon className="mx-auto mb-4 h-12 w-12 animate-spin text-emerald-300" />
              <p className="text-lg font-medium text-white">Locating nearby services...</p>
              <p className="mt-2 text-white/60">Please wait while we find healthcare services near you</p>
            </div>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                <Input
                  placeholder="Search by name or location..."
                  className="pl-11"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-48">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">Distance</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs defaultValue="pharmacies">
              <TabsList className="mb-6 bg-white/5 text-white/70">
                <TabsTrigger value="pharmacies" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">
                  Pharmacies
                </TabsTrigger>
                <TabsTrigger value="doctors" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">
                  Doctors
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pharmacies">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {filteredPharmacies.length > 0 ? (
                    filteredPharmacies.map((pharmacy) => (
                      <Card key={pharmacy.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-white">{pharmacy.name}</CardTitle>
                              <CardDescription className="mt-1 flex items-center text-white/70">
                                <MapPinIcon className="mr-1 h-3 w-3" />
                                {pharmacy.address}
                              </CardDescription>
                            </div>
                            <div className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white">
                              {pharmacy.distance.toFixed(1)} mi
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-2 text-sm text-white/80">
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <PhoneIcon className="mr-2 h-4 w-4 text-white/50" />
                              <span>{pharmacy.phone}</span>
                            </div>
                            <div className="flex items-center">
                              <ClockIcon className="mr-2 h-4 w-4 text-white/50" />
                              <span>{pharmacy.hours}</span>
                            </div>
                            <div className="flex items-center">
                              <span>Ratings unavailable</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter>
                          <div className="flex w-full gap-2">
                            <Button variant="outline" className="flex-1" disabled={pharmacy.phone === "Phone not available"} onClick={() => window.location.assign(`tel:${pharmacy.phone}`)}>
                              <PhoneIcon className="mr-2 h-4 w-4" />
                              Call
                            </Button>
                            <Button
                              className="flex-1"
                              onClick={() => {
                                const query = encodeURIComponent(`${pharmacy.name}, ${pharmacy.address}`)
                                window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, "_blank")
                              }}
                            >
                              <NavigationIcon className="mr-2 h-4 w-4" />
                              Directions
                            </Button>
                          </div>
                        </CardFooter>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-2 rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-white/70">
                      No pharmacies found. Try different keywords.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="doctors">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {filteredDoctors.length > 0 ? (
                    filteredDoctors.map((doctor) => (
                      <Card key={doctor.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-white">{doctor.name}</CardTitle>
                              <CardDescription className="mt-1 text-white/70">Doctor</CardDescription>
                            </div>
                            <div className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white">
                              {doctor.distance.toFixed(1)} mi
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-2 text-sm text-white/80">
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <MapPinIcon className="mr-2 h-4 w-4 text-white/50" />
                              <span>{doctor.address}</span>
                            </div>
                            <div className="flex items-center">
                              <PhoneIcon className="mr-2 h-4 w-4 text-white/50" />
                              <span>{doctor.phone}</span>
                            </div>
                            <div className="flex items-center">
                              <ClockIcon className="mr-2 h-4 w-4 text-white/50" />
                              <span>{doctor.hours}</span>
                            </div>
                            <div className="flex items-center">
                              <span>Ratings unavailable</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter>
                          <div className="flex w-full gap-2">
                            <Button variant="outline" className="flex-1" disabled={doctor.phone === "Phone not available"} onClick={() => window.location.assign(`tel:${doctor.phone}`)}>
                              <PhoneIcon className="mr-2 h-4 w-4" />
                              Call
                            </Button>
                            <Button
                              className="flex-1"
                              onClick={() => {
                                const query = encodeURIComponent(`${doctor.name}, ${doctor.address}`)
                                window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, "_blank")
                              }}
                            >
                              <NavigationIcon className="mr-2 h-4 w-4" />
                              Directions
                            </Button>
                          </div>
                        </CardFooter>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-2 rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-white/70">
                      No doctors found. Try different keywords.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </PageShell>
  )
}
