export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type LeafletCompatibleFeature = {
  id: string;
  label: string;
  state: string;
  center?: GeoPoint;
  properties: Record<string, string | number | boolean | null>;
};

