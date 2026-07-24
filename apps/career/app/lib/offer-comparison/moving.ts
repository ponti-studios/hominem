export interface MovingCosts {
  pet: number;
  shipping: number;
  furniture: number;
  total: number;
  route: 'direct-cargo' | 'paris-eurotunnel';
}

interface MovingInput {
  origin: string;
  dest: string;
  hasDog: boolean;
  boxCount: number;
}

const LA_LDN_ROUTES: Record<string, MovingCosts[]> = {
  'los-angeles→london': [
    {
      pet: 4_000,
      shipping: 600,
      furniture: 3_350,
      total: 7_950,
      route: 'direct-cargo',
    },
    {
      pet: 1_150,
      shipping: 600,
      furniture: 3_350,
      total: 5_100,
      route: 'paris-eurotunnel',
    },
  ],
};

export function computeMovingCosts(input: MovingInput): MovingCosts[] {
  const key = `${input.origin}→${input.dest}`;
  const routes = LA_LDN_ROUTES[key];
  if (routes && input.hasDog) return routes;
  if (routes && !input.hasDog) {
    return routes.map((r) => {
      const zeroed = { ...r, pet: 0 };
      zeroed.total = zeroed.pet + zeroed.shipping + zeroed.furniture;
      return zeroed;
    });
  }

  const base = {
    pet: input.hasDog ? 5_000 : 0,
    shipping: 150 + input.boxCount * 75,
    furniture: 3_000,
  };

  return [
    {
      ...base,
      total: base.pet + base.shipping + base.furniture,
      route: 'direct-cargo',
    },
  ];
}
