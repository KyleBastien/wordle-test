import { playGame } from './test-wordle'

describe('Wordle Solver', () => {
  it('should call console.table with the correct number of attempts given a known word', () => {
    const tableSpy = jest.spyOn(console, 'table')
    playGame('voice')

    // validate that tableSpy was called with the property maxAttempts set to 4
    expect(tableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        maxAttempts: 4
      })
    )
  })
})
