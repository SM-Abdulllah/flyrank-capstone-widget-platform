const submissionRepository = require('../repositories/submissionRepository');

async function listSubmissions(tenantId, filters) {
  return submissionRepository.listForTenant(tenantId, filters);
}

async function getStats(tenantId) {
  return submissionRepository.statsForTenant(tenantId);
}

module.exports = {
  listSubmissions,
  getStats
};

