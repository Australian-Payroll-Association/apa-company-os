import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import { formatCents, type RoiAssumptions, type BerylPrice, type RoiResult } from '@/lib/roi'

// Manager-ready PDF. Server-rendered via renderToBuffer in the pdf route.
// Uses the official logo when public/beryl/apa-logo.png exists (logoSrc passed
// by the route); otherwise falls back to a typographic APA wordmark.

const C = {
  blue: '#48608a', navy: '#2a3850', gold: '#F0BD18', slate: '#a0aec1',
  ink: '#3a3839', muted: '#6b7484', line: '#dde2ea', ground: '#f6f8fb',
  white: '#ffffff', good: '#2f7d5b',
}

const s = StyleSheet.create({
  page: { paddingTop: 46, paddingBottom: 54, paddingHorizontal: 48, fontFamily: 'Helvetica', color: C.ink, fontSize: 10.5, lineHeight: 1.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  logoImg: { height: 34, objectFit: 'contain' },
  wordmark: { flexDirection: 'row', alignItems: 'center' },
  goldSq: { width: 12, height: 12, backgroundColor: C.gold, borderRadius: 2, marginRight: 8 },
  wordmarkText: { fontFamily: 'Helvetica-Bold', color: C.blue, fontSize: 13, letterSpacing: 1 },
  wordmarkSub: { fontFamily: 'Helvetica-Bold', color: C.blue, fontSize: 8, letterSpacing: 2 },
  prepared: { textAlign: 'right', fontSize: 8.5, color: C.muted },
  rule: { height: 3, backgroundColor: C.gold, marginTop: 10, marginBottom: 20, width: 54 },
  h1: { fontFamily: 'Helvetica-Bold', color: C.navy, fontSize: 20, marginBottom: 8 },
  lede: { color: C.ink, fontSize: 11, marginBottom: 20, maxWidth: 420 },
  band: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  hero: { flex: 1, backgroundColor: C.navy, borderRadius: 8, padding: 18 },
  heroCap: { color: C.gold, fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: 6 },
  heroBig: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 26, lineHeight: 1.1, marginBottom: 6 },
  heroPer: { color: '#c7d3e6', fontSize: 9.5, lineHeight: 1.3 },
  inputsCol: { width: 176, backgroundColor: C.ground, borderRadius: 8, borderWidth: 1, borderColor: C.line, padding: 14 },
  inputsTitle: { fontFamily: 'Helvetica-Bold', color: C.navy, fontSize: 9, letterSpacing: .5, marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3.5 },
  rowK: { color: C.muted, fontSize: 9.5 },
  rowV: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  table: { borderWidth: 1, borderColor: C.line, borderRadius: 8, marginBottom: 20 },
  tRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: C.line },
  tRowLast: { borderBottomWidth: 0 },
  tK: { color: C.ink, fontSize: 10.5 },
  tV: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 11 },
  tVgood: { color: C.good, fontFamily: 'Helvetica-Bold', fontSize: 11 },
  h2: { fontFamily: 'Helvetica-Bold', color: C.navy, fontSize: 11, marginBottom: 6 },
  method: { color: C.ink, fontSize: 9.5, marginBottom: 6 },
  fine: { color: C.muted, fontSize: 8.5, lineHeight: 1.45 },
  footer: { position: 'absolute', bottom: 30, left: 48, right: 48, borderTopWidth: 1, borderColor: C.line, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { color: C.muted, fontSize: 8.5 },
  cta: { color: C.blue, fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
})

export interface BerylPdfProps {
  contact: { firstname: string; lastname: string; jobtitle: string; email: string }
  inputs: { teamSize: number; queriesPerUser: number; totalSalary: number }
  assumptions: RoiAssumptions
  price: BerylPrice
  result: RoiResult
  preparedOn: string
  ctaUrl: string
  logoSrc?: string
}

export function BerylRoiPdf(p: BerylPdfProps) {
  const cur = p.price.currency
  const money = (c: number, exact = false) => formatCents(c, cur, { exact })
  const rng = (lo: number, hi: number, exact = false) =>
    lo === hi ? money(lo, exact) : `${money(lo, exact)} – ${money(hi, exact)}`
  const timeSaved = p.assumptions.timeSavedMinMinutes === p.assumptions.timeSavedMaxMinutes
    ? `${p.assumptions.timeSavedMinMinutes} minutes`
    : `${p.assumptions.timeSavedMinMinutes}–${p.assumptions.timeSavedMaxMinutes} minutes`
  const roi = p.result.roiMultipleLow === p.result.roiMultipleHigh
    ? `${p.result.roiMultipleLow.toFixed(1)}×`
    : `${p.result.roiMultipleLow.toFixed(1)}× – ${p.result.roiMultipleHigh.toFixed(1)}×`

  return (
    <Document title={`Beryl ROI — ${p.contact.firstname} ${p.contact.lastname}`} author="Australian Payroll Association">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {p.logoSrc
            ? <Image src={p.logoSrc} style={s.logoImg} />
            : (
              <View style={s.wordmark}>
                <View style={s.goldSq} />
                <View>
                  <Text style={s.wordmarkText}>AUSTRALIAN PAYROLL</Text>
                  <Text style={s.wordmarkSub}>ASSOCIATION</Text>
                </View>
              </View>
            )}
          <View>
            {p.contact.firstname ? <Text style={s.prepared}>Prepared for {p.contact.firstname} {p.contact.lastname}</Text> : null}
            {p.contact.jobtitle ? <Text style={s.prepared}>{p.contact.jobtitle}</Text> : null}
            <Text style={s.prepared}>{p.preparedOn}</Text>
          </View>
        </View>
        <View style={s.rule} />

        <Text style={s.h1}>The case for Beryl</Text>
        <Text style={s.lede}>
          For a team of {p.inputs.teamSize} at typical usage, here is what Beryl is estimated to save each month:
          the time your people spend self-resolving payroll and HR questions, valued against its cost.
        </Text>

        <View style={s.band}>
          <View style={s.hero}>
            <Text style={s.heroCap}>ESTIMATED MONTHLY SAVING</Text>
            <Text style={s.heroBig}>{rng(p.result.monthlySavingLowCents, p.result.monthlySavingHighCents)}</Text>
            <Text style={s.heroPer}>
              {rng(p.result.monthlySavingLowCents / p.inputs.teamSize, p.result.monthlySavingHighCents / p.inputs.teamSize)} per user, per month
            </Text>
          </View>
          <View style={s.inputsCol}>
            <Text style={s.inputsTitle}>Your inputs</Text>
            <View style={s.row}><Text style={s.rowK}>Team size</Text><Text style={s.rowV}>{p.inputs.teamSize}</Text></View>
            <View style={s.row}><Text style={s.rowK}>Questions / user</Text><Text style={s.rowV}>{p.inputs.queriesPerUser}/mo</Text></View>
            <View style={s.row}><Text style={s.rowK}>Team salary</Text><Text style={s.rowV}>{money(p.inputs.totalSalary * 100)}</Text></View>
            <View style={s.row}><Text style={s.rowK}>Hourly rate</Text><Text style={s.rowV}>{money(p.result.hourlyRateCents, true)}</Text></View>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tRow}><Text style={s.tK}>Annual saving</Text><Text style={s.tV}>{rng(p.result.annualSavingLowCents, p.result.annualSavingHighCents)}</Text></View>
          <View style={s.tRow}><Text style={s.tK}>Beryl cost ({money(p.price.amountCents, true)} × {p.inputs.teamSize} users)</Text><Text style={s.tV}>{money(p.result.berylCostCents, true)} / month</Text></View>
          <View style={s.tRow}><Text style={s.tK}>Net benefit / month</Text><Text style={s.tVgood}>{rng(p.result.netBenefitLowCents, p.result.netBenefitHighCents)}</Text></View>
          <View style={[s.tRow, s.tRowLast]}><Text style={s.tK}>Return on investment</Text><Text style={s.tV}>{roi}</Text></View>
        </View>

        <Text style={s.h2}>How we calculate this</Text>
        <Text style={s.method}>
          We assume Beryl saves about {timeSaved} per question: the time a payroll or HR person would otherwise
          spend self-resolving it (reading the award, legislation or policy, or lodging and chasing a helpdesk
          ticket). Each user&rsquo;s time is valued at their hourly rate: total team salary ÷ {p.inputs.teamSize} users
          ÷ {p.assumptions.workingHoursYear.toLocaleString()} working hours a year. Savings are shown against
          Beryl&rsquo;s {money(p.price.amountCents, true)} per user monthly price.
        </Text>
        <Text style={s.fine}>
          Figures are an estimate to support your decision, based on typical Beryl usage, not a guarantee of savings.
        </Text>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Australian Payroll Association · Beryl</Text>
          <Text style={s.cta}>Get started: {p.ctaUrl}</Text>
        </View>
      </Page>
    </Document>
  )
}
