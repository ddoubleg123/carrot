import { assemblyEmails } from '@/lib/polWatch'

describe('assemblyEmails', () => {
  it('reads the published Assembly address for a district', () => {
    const html = '<li><a href="/mem/Nikki-Lucas"> Nikki Lucas</a> <div class="email2">60th District</div> <a href="mailto:lucasn@nyassembly.gov">lucasn@nyassembly.gov</a></li>'
    expect(assemblyEmails(html)).toEqual([{ name: 'Nikki Lucas', district: '60', email: 'lucasn@nyassembly.gov' }])
  })
})
