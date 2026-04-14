// src/components/MealLog.tsx
"use client";
import { Meal } from "@/types";
import { motion } from "framer-motion";
import { format } from "date-fns";
import NudgeCard from "./NudgeCard";

interface MealLogProps {
  meals: Meal[];
}

export default function MealLog({ meals }: MealLogProps) {
  if (meals.length === 0) {
    return (
      <div className="text-center py-10 text-text-muted">
        <p>No meals logged today yet.</p>
        <p className="text-sm">Start by submitting your first craving above!</p>
      </div>
    );
  }

  return (
    <div className="relative border-l border-border-glass ml-4 pl-6 space-y-8 pb-10">
      {meals.map((meal, index) => {
        // Handle multiple timestamp formats (Firestore Timestamp, Date object, or numeric milliseconds)
        const ts = meal.timestamp;
        const time = (ts && typeof ts === "object" && "seconds" in ts)
          ? new Date((ts as any).seconds * 1000)
          : new Date(ts as any);
        
        return (
          <motion.div 
            key={meal.id || index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            {/* Timeline Dot */}
            <div className="absolute -left-[31px] top-4 w-4 h-4 rounded-full bg-dark border-2 border-primary z-10" />
            
            <div className="text-xs font-bold text-text-muted mb-2 tracking-widest uppercase flex items-center gap-2">
              {format(time, "h:mm a")}
            </div>
            
            <NudgeCard meal={meal} />
          </motion.div>
        );
      })}
    </div>
  );
}
