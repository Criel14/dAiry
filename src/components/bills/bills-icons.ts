import {
  ArrowRightLeft,
  Bus,
  Ellipsis,
  Gamepad2,
  GraduationCap,
  HandHeart,
  PiggyBank,
  ReceiptText,
  ShoppingBag,
  Stethoscope,
  Store,
  Tag,
  Trophy,
  Utensils,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-vue-next'

const ICON_MAP: Record<string, LucideIcon> = {
  'arrow-right-left': ArrowRightLeft,
  bus: Bus,
  ellipsis: Ellipsis,
  'gamepad-2': Gamepad2,
  'graduation-cap': GraduationCap,
  'hand-heart': HandHeart,
  'piggy-bank': PiggyBank,
  'receipt-text': ReceiptText,
  'shopping-bag': ShoppingBag,
  stethoscope: Stethoscope,
  store: Store,
  tag: Tag,
  trophy: Trophy,
  utensils: Utensils,
  wallet: Wallet,
  wrench: Wrench,
}

export function iconForName(name: string): LucideIcon {
  return ICON_MAP[name] ?? Ellipsis
}
