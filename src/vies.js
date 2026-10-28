/** EU VIES VAT number validation via the official REST API (free, no key). */
const VIES_URL = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number';

export async function checkVies(vatId, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const norm = (vatId || '').replace(/[\s.-]/g, '').toUpperCase();
  if (norm.startsWith('CHE') || norm.startsWith('CH')) return { checked: false, valid: null, reason: 'switzerland_not_in_vies' };
  const m = /^([A-Z]{2})([A-Z0-9]{2,12})$/.exec(norm);
  if (!m) return { checked: false, valid: null, reason: 'unsupported_format' };
  const [, countryCode, vatNumber] = m;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(VIES_URL, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ countryCode, vatNumber }),
    });
    if (!res.ok) return { checked: false, valid: null, reason: `http_${res.status}` };
    const data = await res.json();
    if (data.actionSucceed === false || (Array.isArray(data.errorWrappers) && data.errorWrappers.length)) {
      return { checked: false, valid: null, reason: data.errorWrappers?.[0]?.error || 'service_error' };
    }
    if (data.userError && data.userError !== 'VALID' && data.userError !== 'INVALID') {
      return { checked: false, valid: null, reason: data.userError };
    }
    if (typeof data.valid !== 'boolean') return { checked: false, valid: null, reason: 'unexpected_response' };
    return {
      checked: true, valid: data.valid === true,
      name: data.name && data.name !== '---' ? data.name.trim() : null,
      address: data.address && data.address !== '---' ? data.address.replace(/\s+/g, ' ').trim() : null,
      requestDate: data.requestDate || null,
    };
  } catch (e) {
    return { checked: false, valid: null, reason: e.name === 'AbortError' ? 'timeout' : `error_${e.message}` };
  } finally { clearTimeout(t); }
}
