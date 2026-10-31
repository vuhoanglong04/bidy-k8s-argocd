/**
 * A product is either a private draft or on the market. Withdrawing it is a soft
 * delete (DELETE /api/v1/products/{id}), not a third status — `inactive` and
 * `archived` used to duplicate that, which meant the "cannot withdraw a product
 * carrying a live auction" rule had to be enforced on two separate doors.
 */
export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
}
