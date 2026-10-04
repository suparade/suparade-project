/** The Gemini detector's base URL. Its own module because server code can't read values out of "use client" lib/detector.tsx. */
export const DETECTOR = (process.env.NEXT_PUBLIC_DETECTOR_URL || "http://localhost:8000").replace(/\/$/, "");
