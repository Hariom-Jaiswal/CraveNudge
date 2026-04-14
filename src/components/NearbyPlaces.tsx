// src/components/NearbyPlaces.tsx
"use client";
import { useEffect, useState } from "react";
import { getNearbyPlaces } from "@/lib/geminiService";
import { MapPin, Star, AlertCircle } from "lucide-react";

interface Place {
  place_id: string;
  name: string;
  rating: number;
  address: string;
}

interface NearbyPlacesProps {
  goal: string;
  healthScore: number;
}

export default function NearbyPlaces({ goal, healthScore }: NearbyPlacesProps) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (healthScore >= 80) {
      // Don't show alternative suggestions if the meal is already excellent
      setLoading(false);
      return;
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const data = await getNearbyPlaces(
              position.coords.latitude,
              position.coords.longitude,
              goal,
              healthScore
            );
            if (data.places) {
              setPlaces(data.places);
            }
          } catch (err) {
            setError("Could not fetch nearby places.");
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          console.warn("Location permission denied", err);
          setError("Location permission denied. Cannot suggest nearby places.");
          setLoading(false);
        }
      );
    } else {
      setError("Geolocation not supported.");
      setLoading(false);
    }
  }, [goal, healthScore]);

  if (healthScore >= 80) return null;
  if (loading) return <div className="animate-pulse bg-white/5 h-32 rounded-xl" />;
  if (error) return <div className="text-sm text-amber-500/80 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> {error}</div>;
  if (places.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-sm font-bold text-text-muted mb-4 uppercase tracking-widest flex items-center gap-2">
        <MapPin className="w-4 h-4" /> Healthy Alternatives Nearby
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
        {places.map(place => (
          <div key={place.place_id} className="glass-panel p-4 min-w-[240px] snap-start flex-shrink-0 relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             <h4 className="font-bold text-white mb-1 truncate">{place.name}</h4>
             <div className="flex items-center text-xs text-amber-400 mb-2">
               <Star className="w-3 h-3 fill-amber-400 mr-1" /> {place.rating}
             </div>
             <p className="text-xs text-text-muted truncate">{place.address}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
