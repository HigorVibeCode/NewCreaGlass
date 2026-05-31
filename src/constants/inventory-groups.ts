/** Nomes canônicos dos grupos de inventário (devem coincidir com inventory_groups.name no Supabase). */
export const INVENTORY_GROUP_NAMES = {
  GLASS: 'Glass',
  PROFILES: 'Profiles',
  SUPPLIES: 'Supplies',
  MONTAGE_ACCESSORIES: 'Montage Accessories',
} as const;

export type InventoryGroupName =
  (typeof INVENTORY_GROUP_NAMES)[keyof typeof INVENTORY_GROUP_NAMES];

/** IDs legados usados no mock e em deep links antigos. */
export const LEGACY_INVENTORY_GROUP_IDS = {
  GLASS: 'group-glass',
  PROFILES: 'group-supplies',
  SUPPLIES: 'group-spare-parts',
  MONTAGE_ACCESSORIES: 'group-montage-accessories',
} as const;

export const LEGACY_GROUP_ID_TO_NAME: Record<string, InventoryGroupName> = {
  [LEGACY_INVENTORY_GROUP_IDS.GLASS]: INVENTORY_GROUP_NAMES.GLASS,
  [LEGACY_INVENTORY_GROUP_IDS.PROFILES]: INVENTORY_GROUP_NAMES.PROFILES,
  [LEGACY_INVENTORY_GROUP_IDS.SUPPLIES]: INVENTORY_GROUP_NAMES.SUPPLIES,
  [LEGACY_INVENTORY_GROUP_IDS.MONTAGE_ACCESSORIES]:
    INVENTORY_GROUP_NAMES.MONTAGE_ACCESSORIES,
};

export function isGlassInventoryGroup(groupName: string | undefined): boolean {
  return groupName === INVENTORY_GROUP_NAMES.GLASS;
}

export function isProfilesInventoryGroup(groupName: string | undefined): boolean {
  return groupName === INVENTORY_GROUP_NAMES.PROFILES;
}

export function isSuppliesInventoryGroup(groupName: string | undefined): boolean {
  return groupName === INVENTORY_GROUP_NAMES.SUPPLIES;
}

export function isMontageAccessoriesInventoryGroup(groupName: string | undefined): boolean {
  return groupName === INVENTORY_GROUP_NAMES.MONTAGE_ACCESSORIES;
}

/** Profiles, Supplies e Montage Accessories: cards com imagem, posição, etc. */
export function hasInventoryImageCards(groupName: string | undefined): boolean {
  return (
    isProfilesInventoryGroup(groupName) ||
    isSuppliesInventoryGroup(groupName) ||
    isMontageAccessoriesInventoryGroup(groupName)
  );
}

export function getInventoryGroupIcon(
  groupName: string
): keyof typeof import('@expo/vector-icons').Ionicons.glyphMap {
  switch (groupName) {
    case INVENTORY_GROUP_NAMES.GLASS:
      return 'layers-outline';
    case INVENTORY_GROUP_NAMES.PROFILES:
      return 'reorder-four-outline';
    case INVENTORY_GROUP_NAMES.SUPPLIES:
      return 'cube-outline';
    case INVENTORY_GROUP_NAMES.MONTAGE_ACCESSORIES:
      return 'construct-outline';
    default:
      return 'cube-outline';
  }
}

export function getInventoryGroupColor(groupName: string, fallback: string): string {
  switch (groupName) {
    case INVENTORY_GROUP_NAMES.GLASS:
      return '#3B82F6';
    case INVENTORY_GROUP_NAMES.PROFILES:
      return '#F59E0B';
    case INVENTORY_GROUP_NAMES.SUPPLIES:
      return '#10B981';
    case INVENTORY_GROUP_NAMES.MONTAGE_ACCESSORIES:
      return '#8B5CF6';
    default:
      return fallback;
  }
}
