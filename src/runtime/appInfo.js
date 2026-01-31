// Captura información del runtime del servidor al arrancar
// Esta info es estática durante toda la vida del proceso

export const APP_STARTED_AT = new Date().toISOString();

export function getRuntimeInfo() {
  return {
    startedAt: APP_STARTED_AT,
    nodeEnv: process.env.NODE_ENV || 'N/A',
    cloudRun: {
      service: process.env.K_SERVICE || 'local',
      revision: process.env.K_REVISION || 'N/A',
    },
    gitSha: process.env.GIT_SHA || 'N/A',
  };
}
