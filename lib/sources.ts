export type SourceType = "inbound" | "data";

export type Source = {
  id: string;
  name: string;
  type: SourceType;
  baseCpl: number;
};

export const SOURCES: Source[] = [
  // INBOUND
  { id: "alpha1", name: "Alpha Brain 1", type: "inbound", baseCpl: 70 },
  { id: "alpha2", name: "Alpha Brain 2", type: "inbound", baseCpl: 45 },
  { id: "night", name: "Night Crawlers", type: "inbound", baseCpl: 25 },
  { id: "archive", name: "Archive 6", type: "inbound", baseCpl: 40 },
  { id: "sprinters", name: "Sprinters", type: "inbound", baseCpl: 110 },
  { id: "fuega", name: "Fuega", type: "inbound", baseCpl: 35 },
  { id: "keystone-in", name: "Keystone Inbound", type: "inbound", baseCpl: 90 },
  { id: "keystone-lt", name: "Keystone LT", type: "inbound", baseCpl: 85 },
  { id: "promo", name: "Nextgen Promo", type: "inbound", baseCpl: 55.64 },
  { id: "infinix-best", name: "Infinix Best", type: "inbound", baseCpl: 90 },
  { id: "infinix-better", name: "Infinix Better", type: "inbound", baseCpl: 120 },
  { id: "infinix-lt", name: "Infinix LT", type: "inbound", baseCpl: 90 },
  { id: "revrise", name: "Revrise Calls", type: "inbound", baseCpl: 65 },
  { id: "t1", name: "T1", type: "inbound", baseCpl: 80 },

  // DATA
  { id: "keystone-data", name: "Keystone Data", type: "data", baseCpl: 33 },
  { id: "plplus", name: "Nextgen PL+", type: "data", baseCpl: 15.1 },
  { id: "exclusive", name: "Infinix Exclusive", type: "data", baseCpl: 32 },
  { id: "semi", name: "Infinix Semi-Exclusive", type: "data", baseCpl: 16 },
  { id: "premium", name: "Infinix Premium", type: "data", baseCpl: 10 },
  { id: "shared", name: "Infinix Shared", type: "data", baseCpl: 6 },
  { id: "overnight", name: "Infinix Overnight", type: "data", baseCpl: 3 },
  { id: "revrise-data", name: "Revrise Data", type: "data", baseCpl: 4.25 },
];