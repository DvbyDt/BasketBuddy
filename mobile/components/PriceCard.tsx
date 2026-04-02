import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Item, getCheapestStore, getItemPrices, fmt, fmtPerUnit, getSavings } from '../shared/store';
import { StoreBadge } from './StoreBadge';
import { COLORS, SHADOWS } from '../shared/theme';
import { useBasket } from '../shared/BasketContext';
import { getBestOffer } from '../shared/offers';

interface Props {
  item: Item;
  onPress?: () => void;
  showAllPrices?: boolean;
}

export function PriceCard({ item, onPress }: Props) {
  const { addToBasket, removeFromBasket, isInBasket, getQuantity, updateQuantity } = useBasket();
  const cheapest = getCheapestStore(item);
  const saving = getSavings(item);
  const prices = getItemPrices(item);

  if (!cheapest) return null;

  return (
    <TouchableOpacity
      style={[styles.card, SHADOWS.card]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Card header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
            {item.quantity ? (
              <Text style={styles.quantityLabel}> ({item.quantity})</Text>
            ) : null}
          </Text>
          <Text style={styles.category}>{item.category}</Text>
        </View>
        {saving > 0 && (
          <View style={styles.savingPill}>
            <Text style={styles.savingText}>Save {fmt(saving)}</Text>
          </View>
        )}
      </View>

      {/* Price rows */}
      <View style={styles.priceList}>
        {prices.map((p, i) => {
          const inBasket = isInBasket(item.id, p.store.id);
          const qty = getQuantity(item.id, p.store.id);
          const isCheapest = i === 0;
          const isMostExpensive = i === prices.length - 1 && prices.length > 1;

          // Check for offer on this item+store
          const bestOffer = getBestOffer(item.id, p.store.id, p.price, qty);

          return (
            <View
              key={`${item.id}-${p.store.id}`}
              style={[styles.priceRow, inBasket && styles.priceRowActive]}
            >
              {/* Left: store + price + offer badge */}
              <View style={styles.rowLeft}>
                <StoreBadge store={p.store} size="sm" />
                <View>
                  <View style={styles.priceLine}>
                    {bestOffer ? (
                      <>
                        <Text style={styles.priceStruck}>{fmt(p.price)}</Text>
                        <Text style={[styles.priceAmount, styles.offerPrice]}>
                          {fmt(bestOffer.discountedPrice)}
                        </Text>
                      </>
                    ) : (
                      <Text style={[
                        styles.priceAmount,
                        isCheapest && styles.cheapestPrice,
                        isMostExpensive && styles.expensivePrice,
                      ]}>
                        {fmt(p.price)}
                      </Text>
                    )}
                    {isCheapest && prices.length > 1 && !bestOffer && (
                      <View style={styles.bestTag}>
                        <Text style={styles.bestTagText}>Best</Text>
                      </View>
                    )}
                  </View>
                  {/* Price per 100g/ml — only shown when quantity is parseable */}
                  {(() => {
                    const effectivePrice = bestOffer ? bestOffer.discountedPrice : p.price;
                    const perUnit = fmtPerUnit(effectivePrice, item.quantity ?? '');
                    return perUnit ? (
                      <Text style={styles.perUnit}>{perUnit}</Text>
                    ) : null;
                  })()}
                  {/* Offer label below price */}
                  {bestOffer && (
                    <View style={styles.offerTag}>
                      <Text style={styles.offerTagText}>🏷️ {bestOffer.offerLabel}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Right: add / qty controls */}
              <View style={styles.rowRight}>
                {!inBasket ? (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => addToBasket(item, p.store.id, 1)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => {
                        if (qty <= 1) removeFromBasket(item.id, p.store.id);
                        else updateQuantity(item.id, p.store.id, qty - 1);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.qtyBtnText}>{qty <= 1 ? '✕' : '−'}</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyNum}>{qty}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.id, p.store.id, qty + 1)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                    <Text style={styles.addedCheck}>✓</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  name: { fontSize: 16, fontWeight: '800', color: COLORS.text, lineHeight: 21 },
  quantityLabel: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  category: { fontSize: 12, fontWeight: '700', color: COLORS.muted, marginTop: 2 },
  savingPill: {
    backgroundColor: COLORS.savingBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    flexShrink: 0,
  },
  savingText: { color: COLORS.green, fontWeight: '800', fontSize: 11 },
  priceList: { gap: 6 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  priceRowActive: {
    backgroundColor: '#F0FDF8',
    borderColor: COLORS.green,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  priceAmount: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  cheapestPrice: { color: COLORS.green },
  expensivePrice: { color: COLORS.red },
  perUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.muted,
    marginTop: 1,
  },
  priceStruck: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    textDecorationLine: 'line-through',
  },
  offerPrice: { color: '#9B5DE5', fontSize: 16 },
  bestTag: {
    backgroundColor: COLORS.savingBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bestTagText: { fontSize: 10, fontWeight: '800', color: COLORS.green },
  offerTag: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  offerTagText: { fontSize: 10, fontWeight: '800', color: '#7C3AED' },
  // Add button
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  // Qty controls
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: {
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  qtyNum: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    minWidth: 20,
    textAlign: 'center',
  },
  addedCheck: { color: COLORS.green, fontWeight: '800', fontSize: 15, marginLeft: 2 },
});