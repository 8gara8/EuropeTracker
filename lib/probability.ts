import { PROBABILITY_TERM_IDS, PROBABILITY_TERMS, type ProbabilityTerm } from "./vocab";

/** The term whose band contains `p`, or null when `p` falls in a gap or outside 0–100. */
export function termFor(p: number): ProbabilityTerm | null {
  for (const term of PROBABILITY_TERM_IDS) {
    if (inBand(p, term)) return term;
  }
  return null;
}

export function inBand(p: number, term: ProbabilityTerm): boolean {
  const band = PROBABILITY_TERMS[term];
  return Number.isInteger(p) && p >= band.min && p <= band.max;
}

/** True for integers in 0–100 that belong to no term (6–9, 21–24, 36–39, 51–54, 76–79, 91–94). */
export function inGap(p: number): boolean {
  return Number.isInteger(p) && p >= 0 && p <= 100 && termFor(p) === null;
}

export function bandLabel(term: ProbabilityTerm): string {
  const band = PROBABILITY_TERMS[term];
  return `${band.label} (${band.min}–${band.max}%)`;
}
