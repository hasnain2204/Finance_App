import {
  Car,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Receipt,
  ShoppingBag,
  Tag,
  UtensilsCrossed,
  Wallet
} from 'lucide-react';

export function getCategoryIconComponent(nameOrId = '') {
  const normalized = String(nameOrId || '').toLowerCase().trim();

  if (
    normalized.includes('food') ||
    normalized.includes('grocer') ||
    normalized.includes('din') ||
    normalized.includes('eat') ||
    normalized.includes('restaurant') ||
    normalized.includes('cafe')
  ) {
    return UtensilsCrossed;
  }
  if (
    normalized.includes('transport') ||
    normalized.includes('fuel') ||
    normalized.includes('petrol') ||
    normalized.includes('car') ||
    normalized.includes('ride') ||
    normalized.includes('cab') ||
    normalized.includes('travel')
  ) {
    return Car;
  }
  if (
    normalized.includes('education') ||
    normalized.includes('school') ||
    normalized.includes('college') ||
    normalized.includes('study') ||
    normalized.includes('book') ||
    normalized.includes('fee')
  ) {
    return GraduationCap;
  }
  if (
    normalized.includes('bill') ||
    normalized.includes('utilit') ||
    normalized.includes('electr') ||
    normalized.includes('gas') ||
    normalized.includes('water') ||
    normalized.includes('wifi') ||
    normalized.includes('internet')
  ) {
    return Receipt;
  }
  if (
    normalized.includes('shop') ||
    normalized.includes('cloth') ||
    normalized.includes('mart') ||
    normalized.includes('store') ||
    normalized.includes('dress')
  ) {
    return ShoppingBag;
  }
  if (
    normalized.includes('health') ||
    normalized.includes('med') ||
    normalized.includes('doctor') ||
    normalized.includes('pharm') ||
    normalized.includes('clinic')
  ) {
    return HeartPulse;
  }
  if (
    normalized.includes('entertain') ||
    normalized.includes('movie') ||
    normalized.includes('game') ||
    normalized.includes('cinema') ||
    normalized.includes('fun')
  ) {
    return Film;
  }
  if (
    normalized.includes('salary') ||
    normalized.includes('freelance') ||
    normalized.includes('income') ||
    normalized.includes('earning')
  ) {
    return Wallet;
  }
  if (
    normalized.includes('home') ||
    normalized.includes('rent') ||
    normalized.includes('flat') ||
    normalized.includes('house')
  ) {
    return Home;
  }
  if (
    normalized.includes('gift') ||
    normalized.includes('donat') ||
    normalized.includes('charity')
  ) {
    return Gift;
  }

  return Tag;
}

export function CategoryIcon({ nameOrId, size = 18, className = '' }) {
  const IconComponent = getCategoryIconComponent(nameOrId);
  return <IconComponent size={size} className={className} />;
}
