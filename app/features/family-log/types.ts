export type FamilyLogKind = 'checkin' | 'route' | 'note';

export type FamilyLogCard = {
  id: string;
  group_id: string;
  title: string;
  kind: FamilyLogKind;
  day_date: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  note: string | null;
  mood_tags: string[];
  show_map: boolean;
  amount: number | null;
  currency: string | null;
  collage_style: 'film' | 'postal' | null;
  created_at: string;
  updated_at: string;
};

export type FamilyLogGrain = 'recent' | 'day' | 'month' | 'year';
