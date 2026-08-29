'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';

export type FrameGestureHintPhase = 'h' | 'v' | 'tap';

export default function FrameGestureHintOverlay({
  phase,
  photoLabel,
  frameLabel,
  tapLabel,
}: {
  phase: FrameGestureHintPhase;
  photoLabel: string;
  frameLabel: string;
  tapLabel: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/40 px-4 text-center">
      <AnimatePresence mode="wait">
        {phase === 'h' ? (
          <motion.div
            key="h"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="flex flex-col items-center"
          >
            <div className="flex items-center gap-2 text-white">
              <ChevronLeft className="h-6 w-6" strokeWidth={2.5} aria-hidden />
              <motion.div
                animate={{ x: [-14, 14, -14] }}
                transition={{ duration: 1.55, repeat: Infinity, ease: 'easeInOut' }}
                className="h-9 w-9 rounded-full border-2 border-white/90 bg-white/25"
              />
              <ChevronRight className="h-6 w-6" strokeWidth={2.5} aria-hidden />
            </div>
            <p className="mt-2 text-xs font-semibold text-white drop-shadow">{photoLabel}</p>
          </motion.div>
        ) : null}
        {phase === 'v' ? (
          <motion.div
            key="v"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="flex flex-col items-center"
          >
            <ChevronUp className="h-6 w-6 text-white" strokeWidth={2.5} aria-hidden />
            <motion.div
              animate={{ y: [-12, 12, -12] }}
              transition={{ duration: 1.55, repeat: Infinity, ease: 'easeInOut' }}
              className="my-1 h-9 w-9 rounded-full border-2 border-white/90 bg-white/25"
            />
            <ChevronDown className="h-6 w-6 text-white" strokeWidth={2.5} aria-hidden />
            <p className="mt-2 text-xs font-semibold text-white drop-shadow">{frameLabel}</p>
          </motion.div>
        ) : null}
        {phase === 'tap' ? (
          <motion.div
            key="tap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={{ scale: [1, 0.88, 1] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/90 bg-white/25"
            >
              <span className="h-3 w-3 rounded-full bg-white" />
            </motion.div>
            <p className="mt-2 text-xs font-semibold text-white drop-shadow">{tapLabel}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
