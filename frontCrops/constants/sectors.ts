/** API sector ids — must match backend `normalize_sector` canonical keys. */
export type CropSectorId = 'orchard_canopy' | 'field_core' | 'crop_vision';

export const STORAGE_KEY_SECTOR = 'crop_sector_v1';

export const CROP_SECTORS: {
  id: CropSectorId;
  /** Short marketing name */
  brand: string;
  /** One-line pitch */
  subtitle: string;
  /** Bullet crops / scope */
  highlights: string[];
}[] = [
  {
    id: 'orchard_canopy',
    brand: 'Canopy Lab',
    subtitle: 'Garden & orchard intelligence',
    highlights: [
      'Tomato, grape, apple, pepper, potato & more',
      '38 fine-grained disease classes',
      'Ideal for fruits, vegetables & specialty crops',
    ],
  },
  {
    id: 'field_core',
    brand: 'AgriCore',
    subtitle: 'Staple crop belt scanner',
    highlights: ['Corn', 'Potato', 'Rice', 'Wheat', 'Sugarcane', 'Built for broadacre & subsistence farms'],
  },
  {
    id: 'crop_vision',
    brand: 'CropVision',
    subtitle: 'CNN-powered multi-crop diagnostics',
    highlights: [
      'Corn, Potato, Rice, Wheat, Sugarcane',
      '17 disease classes · 20K training images',
      'Deep CNN model for field crop analysis',
    ],
  },
];

export function isCropSectorId(v: string | null | undefined): v is CropSectorId {
  return v === 'orchard_canopy' || v === 'field_core' || v === 'crop_vision';
}
