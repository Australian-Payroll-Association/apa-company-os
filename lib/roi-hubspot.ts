// Beryl ROI — HubSpot lead mirror via the Forms API.
// The public form-submission endpoint needs no private-app token: it targets a
// portal + form GUID and natively creates/updates the contact and fires the
// form's HubSpot automation. Portal/form are overridable via env for staging.

const PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || '40101382'
const FORM_GUID = process.env.HUBSPOT_FORM_GUID || 'c380c654-3b7e-4464-998a-d338bfd6fcb2'

const CONSENT_TEXT =
  'By submitting your details to access this resource, you will be added to our mailing list.'

export interface BerylContact {
  firstname: string
  lastname: string
  jobtitle: string
  email: string
  pageUri?: string
}

// Best-effort: a HubSpot failure must never block the PDF or the native lead.
export async function submitBerylLeadToHubSpot(c: BerylContact): Promise<{ ok: boolean; error?: string }> {
  const url = `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_GUID}`
  const body = {
    fields: [
      { name: 'firstname', value: c.firstname },
      { name: 'lastname', value: c.lastname },
      { name: 'jobtitle', value: c.jobtitle },
      { name: 'email', value: c.email },
    ],
    legalConsentOptions: {
      consent: {
        consentToProcess: true,
        text: CONSENT_TEXT,
      },
    },
    context: {
      pageUri: c.pageUri || 'https://austpayroll.com.au/beryl',
      pageName: 'Beryl ROI Calculator',
    },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[beryl-roi] HubSpot form submit failed:', res.status, detail.slice(0, 300))
      return { ok: false, error: `hubspot_${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    console.error('[beryl-roi] HubSpot form submit threw:', err)
    return { ok: false, error: 'hubspot_network' }
  }
}
