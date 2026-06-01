/**
 * Returns the custom phase label if set in match_config.phaseLabel,
 * otherwise falls back to "Fase {phaseNumber}".
 */
export const getPhaseLabel = (
  phaseNumber: number,
  phases: Array<{ phase_number: number; match_config?: Record<string, any> | null }>
): string => {
  const firstFormat = phases.find(p => p.phase_number === phaseNumber);
  const customLabel = firstFormat?.match_config?.phaseLabel;
  return typeof customLabel === "string" && customLabel.trim()
    ? customLabel.trim()
    : `Fase ${phaseNumber}`;
};
