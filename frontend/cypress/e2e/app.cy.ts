describe('Application', () => {
  it('should load the homepage', () => {
    cy.visit('/')
    cy.contains('Get started by editing') // Adjust this to match text on your homepage
  })
})