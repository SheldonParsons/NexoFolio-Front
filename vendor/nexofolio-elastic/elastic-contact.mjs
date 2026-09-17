// Two equal-mass pages with a short, damped contact. All units are model units.
export function resolvePageContact(parts, heldIndex = null, reduced = false) {
  const [left, right] = parts;
  const minimumGap = .12;
  const gap = (right.rest + right.x) - (left.rest + left.x);
  if (gap >= minimumGap) return null;
  const leftWeight = heldIndex === 0 ? 0 : 1;
  const rightWeight = heldIndex === 1 ? 0 : 1;
  const totalWeight = leftWeight + rightWeight;
  if (!totalWeight) return null;
  const penetration = minimumGap - gap;
  left.x -= penetration * leftWeight / totalWeight;
  right.x += penetration * rightWeight / totalWeight;
  const closingSpeed = left.vx - right.vx;
  if (closingSpeed <= 0) return null;
  const restitution = reduced ? 0 : .22;
  const impulse = (1 + restitution) * closingSpeed / totalWeight;
  left.vx -= impulse * leftWeight;
  right.vx += impulse * rightWeight;
  if (!reduced && closingSpeed > .15) {
    const squeeze = Math.min(5, closingSpeed * 1.25);
    left.cv = Math.min(7, left.cv + squeeze);
    right.cv = Math.min(7, right.cv + squeeze);
    left.vy += Math.min(.28, impulse * .1) * leftWeight;
    right.vy += Math.min(.28, impulse * .1) * rightWeight;
  }
  return {closingSpeed, impulse};
}
