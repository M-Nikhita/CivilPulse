export const CHENNAI_ZONES = [
  { id: 'Zone 1', name: 'Thiruvottiyur', start: 1, end: 14 },
  { id: 'Zone 2', name: 'Manali', start: 15, end: 21 },
  { id: 'Zone 3', name: 'Madhavaram', start: 22, end: 33 },
  { id: 'Zone 4', name: 'Tondiarpet', start: 34, end: 48 },
  { id: 'Zone 5', name: 'Royapuram', start: 49, end: 63 },
  { id: 'Zone 6', name: 'Thiru. Vi. Ka. Nagar', start: 64, end: 78 },
  { id: 'Zone 7', name: 'Ambattur', start: 79, end: 93 },
  { id: 'Zone 8', name: 'Anna Nagar', start: 94, end: 108 },
  { id: 'Zone 9', name: 'Teynampet', start: 109, end: 126 },
  { id: 'Zone 10', name: 'Kodambakkam', start: 127, end: 142 },
  { id: 'Zone 11', name: 'Valasaravakkam', start: 143, end: 155 },
  { id: 'Zone 12', name: 'Alandur', start: 156, end: 167 },
  { id: 'Zone 13', name: 'Adyar', start: 168, end: 180 },
  { id: 'Zone 14', name: 'Perungudi', start: 181, end: 191 },
  { id: 'Zone 15', name: 'Sholinganallur', start: 192, end: 200 },
];

export const CHENNAI_WARDS = [];

CHENNAI_ZONES.forEach(zone => {
  for (let i = zone.start; i <= zone.end; i++) {
    CHENNAI_WARDS.push({
      id: `Ward ${i}`,
      label: `Ward ${i} (${zone.name})`,
      zoneId: zone.id,
      zoneName: zone.name
    });
  }
});
