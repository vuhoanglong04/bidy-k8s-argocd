/**
 * The smallest bid an auction will accept next.
 *
 * Lives on its own so the bid validator, the auction detail response and the
 * socket payload all read the same rule: a client that renders this number can
 * never suggest an amount the server would then reject. Its own module because
 * both AuctionService and AuctionWebSocketService need it, and they already
 * depend on each other in the other direction.
 *
 * Money columns are Postgres `decimal`, which the driver hands back as strings —
 * hence the explicit Number() rather than arithmetic on the raw fields.
 */
export function computeMinNextBid(auction: {
  currentPrice?: number | string | null;
  startingPrice?: number | string | null;
  bidIncrement?: number | string | null;
}): number {
  const current = Number(auction.currentPrice) || Number(auction.startingPrice) || 0;
  return current + Number(auction.bidIncrement ?? 0);
}
