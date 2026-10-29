export interface ProjectCost {
  status: 'available' | 'pending' | 'unavailable';
  currency?: string;
  grossCost?: number;
  netCost?: number;
  latestUsage?: string;
  exportedAt?: string;
  checkedAt: string;
  stale?: boolean;
}

type BigQueryResponse = {
  jobComplete?: boolean;
  jobReference?: { jobId: string; location?: string };
  rows?: Array<{ f: Array<{ v: string | null }> }>;
  errors?: Array<{ message?: string }>;
};

let cached: ProjectCost | undefined;
let expiresAt = 0;
let inFlight: Promise<ProjectCost> | undefined;
const SUCCESS_TTL_MS = 60 * 60 * 1000;
const FAILURE_TTL_MS = 5 * 60 * 1000;

function timestamp(value: string | null): string | undefined {
  if (!value) return undefined;
  const milliseconds = Number(value) * 1000;
  const date = new Date(Number.isFinite(milliseconds) ? milliseconds : value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

export async function readCost(project: string): Promise<ProjectCost> {
  const checkedAt = new Date().toISOString();
  try {
    const metadata = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(5000),
    });
    if (!metadata.ok) throw new Error('Service account unavailable');
    const { access_token: token } = await metadata.json() as { access_token: string };
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const base = `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(project)}`;
    let response = await fetch(`${base}/queries`, {
      method: 'POST', headers, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ query: `CALL \`${project}.billing_dashboard.project_cost\`()`, useLegacySql: false,
        location: 'US', timeoutMs: 10000, maximumBytesBilled: '1073741824' }),
    });
    let result = await response.json() as BigQueryResponse & { error?: { message?: string } };
    if (!response.ok) {
      if (/not found/i.test(result.error?.message || '')) return { status: 'pending', checkedAt };
      throw new Error('Billing query failed');
    }
    if (!result.jobComplete && result.jobReference) {
      response = await fetch(`${base}/queries/${encodeURIComponent(result.jobReference.jobId)}?location=US&timeoutMs=10000`, {
        headers, signal: AbortSignal.timeout(15000),
      });
      result = await response.json() as BigQueryResponse;
      if (!response.ok || !result.jobComplete) throw new Error('Billing query not ready');
    }
    if (result.errors?.length) {
      if (result.errors.some((error) => /not found/i.test(error.message || ''))) return { status: 'pending', checkedAt };
      throw new Error('Billing query failed');
    }
    if (!result.jobComplete) throw new Error('Billing query did not complete');
    if (!result.rows?.length) return { status: 'pending', checkedAt };
    if (result.rows.length !== 1) throw new Error('Multiple billing currencies');
    const values = result.rows[0].f.map((field) => field.v);
    if (values[0] === 'PENDING') return { status: 'pending', checkedAt };
    const grossCost = Number(values[1]);
    const netCost = Number(values[2]);
    if (!values[0] || values[1] === null || values[2] === null || !Number.isFinite(grossCost) || !Number.isFinite(netCost)) {
      throw new Error('Invalid billing result');
    }
    return { status: 'available', currency: values[0], grossCost, netCost,
      exportedAt: timestamp(values[3]), latestUsage: timestamp(values[4]), checkedAt };
  } catch {
    return { status: 'unavailable', checkedAt };
  }
}

export async function getProjectCost(): Promise<ProjectCost> {
  if (cached && Date.now() < expiresAt) return cached;
  if (inFlight) return inFlight;
  const project = process.env.COST_REPORT_PROJECT;
  if (!project || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)) {
    return { status: 'unavailable', checkedAt: new Date().toISOString() };
  }
  inFlight = readCost(project).then((result) => {
    const available = result.status === 'available';
    if (!available && cached?.status === 'available') {
      cached = { ...cached, stale: true };
    } else {
      cached = result;
    }
    expiresAt = Date.now() + (available ? SUCCESS_TTL_MS : FAILURE_TTL_MS);
    return cached;
  }).finally(() => { inFlight = undefined; });
  return inFlight;
}
