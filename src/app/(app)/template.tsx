"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

// Muatan pertama tidak dianimasikan: konten dari server langsung tampil (tidak menunggu JavaScript).
// Perpindahan halaman berikutnya (template dipasang ulang tiap navigasi) mendapat animasi masuk.
const session = { hasNavigated: false };

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [animate] = useState(() => session.hasNavigated);
  useEffect(() => {
    session.hasNavigated = true;
  }, []);

  return (
    <motion.div
      initial={!animate ? false : reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
