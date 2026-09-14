export function quantityInTablets(quantity, unit, tabletsPerPack = 1) {
  const amount = Number(quantity);
  const packSize = Number(tabletsPerPack);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_QUANTITY');
  if (unit === 'PLAQUETTE') {
    if (!Number.isInteger(packSize) || packSize <= 0) throw new Error('INVALID_PACK_SIZE');
    return amount * packSize;
  }
  return amount;
}

export function productTotals(products, batches) {
  return products.reduce((totals, product) => {
    const stock = batches.filter(batch => batch.productId === product.id).reduce((sum, batch) => sum + (Number(batch.available) || 0), 0);
    totals.buyValue += stock * (Number(product.buyPrice) || 0);
    totals.saleValue += stock * (Number(product.salePrice) || 0);
    totals.stock += stock;
    return totals;
  }, { stock: 0, buyValue: 0, saleValue: 0 });
}
