// src/components/NudgeCard.tsx
"use client";
import { motion } from "framer-motion";
import { Meal } from "@/types";
import { AlertCircle, CheckCircle, TrendingUp } from "lucide-react";

interface NudgeCardProps {
  meal: Meal;
}

export default function NudgeCard({ meal }: NudgeCardProps) {
  const isHealthy = meal.healthScore >= 60;
  const isExcellent = meal.healthScore >= 80;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`glass-panel p-6 relative overflow-hidden \${isHealthy ? 'border-primary/30' : 'border-amber-500/30'}`}
      role="status"
      aria-live="polite"
    >
      <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-20 rounded-full \${isHealthy ? 'bg-primary' : 'bg-amber-500'}`} />
      
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div>
          <h3 className="text-xl font-bold text-white mb-1 capitalize flex items-center gap-2">
            {meal.name}
            {isExcellent && <CheckCircle className="w-5 h-5 text-primary" aria-label="Excellent health score" />}
          </h3>
          <p className="text-sm text-text-muted">{meal.category} • {meal.calories} kcal</p>
        </div>
        
        <div className="flex flex-col items-end">
          <div
            className="flex items-baseline space-x-1"
            aria-label={`Health score: ${meal.healthScore} out of 100`}
          >
            <span
              className={`text-3xl font-black tracking-tighter ${isHealthy ? 'text-primary' : 'text-amber-400'}`}
              aria-hidden="true"
            >
              {meal.healthScore}
            </span>
            <span className="text-xs font-semibold text-text-muted uppercase" aria-hidden="true">/ 100</span>
          </div>
          <span className="text-[10px] text-text-muted font-medium mt-1" aria-hidden="true">HEALTH SCORE</span>
        </div>
      </div>

      <div className="bg-black/20 rounded-xl p-4 border border-white/5 relative z-10">
        <div className="flex gap-3">
          {isHealthy ? (
            <TrendingUp className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm leading-relaxed text-zinc-300">
            {meal.nudgeMessage || "Analyzing meal impact on your goals..."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4 relative z-10 pt-4 border-t border-white/5">
         <div className="text-center">
            <div className="text-xs text-text-muted mb-1">Protein</div>
            <div className="font-semibold text-white">{meal.protein_g}g</div>
         </div>
         <div className="text-center">
            <div className="text-xs text-text-muted mb-1">Carbs/Sugar</div>
            <div className="font-semibold text-white">{meal.sugar_g}g</div>
         </div>
         <div className="text-center">
            <div className="text-xs text-text-muted mb-1">Fat</div>
            <div className="font-semibold text-white">{meal.fat_g}g</div>
         </div>
         <div className="text-center">
            <div className="text-xs text-text-muted mb-1">Fiber</div>
            <div className="font-semibold text-white">{meal.fiber_g}g</div>
         </div>
      </div>
    </motion.div>
  );
}
