export type FamilyLogKind = 'checkin' | 'route' | 'note';

export type FamilyLogRoutePoint = {
  latitude: number;
  longitude: number;
};

export type FamilyLogCard = {
  id: string;
  group_id: string;
  title: string;
  kind: FamilyLogKind;
  day_date: string;
  latitude: number | null;
  longitude: number | null;
  place_latitude: number | null;
  place_longitude: number | null;
  route_points: FamilyLogRoutePoint[];
  address: string | null;
  note: string | null;
  mood_tags: string[];
  show_map: boolean;
  amount: number | null;
  currency: string | null;
  collage_style: 'film' | 'postal' | null;
  rating: number | null;
  is_revisit: boolean;
  created_at: string;
  updated_at: string;
};

export type FamilyLogGrain = 'recent' | 'day' | 'month' | 'year';
