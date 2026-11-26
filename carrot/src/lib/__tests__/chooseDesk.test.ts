import { chooseDesk } from '../curator/assign'

describe('chooseDesk', () => {
  it('sends a current Israel story to Israel and Palestine', () => {
    expect(chooseDesk('Ceasefire talks in Gaza as Israel and Hamas meet').id).toBe('olive-ledger')
  })

  it('sends the Balfour Declaration to How Israel Started', () => {
    expect(chooseDesk('The Balfour Declaration and the British Mandate in 1917').id).toBe('mandate-file')
  })

  it('leaves an engineering page on the unsorted account', () => {
    expect(chooseDesk('How a jet engine compressor stage works').id).toBe('finds')
    expect(chooseDesk('How a jet engine compressor stage works').name).toBe('Everything Else')
  })
})
