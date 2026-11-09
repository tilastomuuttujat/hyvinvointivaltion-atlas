import { describe, expect, it } from 'vitest';
import { mapDetail, recordedMapDetails } from '@/lib/atlas.map-detail';
describe('continuous map detail', () => {
  it('reveals concepts closer in and hides them again when zooming out', () => {
    expect(mapDetail(1)).toBe('terrain');
    expect(mapDetail(1.5)).toBe('conclusions');
    expect(mapDetail(2)).toBe('concepts');
    expect(mapDetail(2.8)).toBe('evidence');
    expect(mapDetail(1)).toBe('terrain');
  });
  it('uses only exact recorded concepts for the same conclusion and period', () => {
    const detail = recordedMapDetails([
      { c:1,p:'p1',articleNo:7,concepts:['Oikeudet'],relation:'context' },
      { c:1,p:'p2',articleNo:8,concepts:['Koulutus'],relation:'direct' },
      { c:2,p:'p1',articleNo:9,concepts:['Työ'],relation:'direct' },
      { c:1,p:'p1',articleNo:10,concepts:['Hylätty'],relation:'direct',reviewStatus:'rejected' },
    ],1,'p1');
    expect(detail).toEqual({ concepts:[{label:'Oikeudet',articles:[7]}],articles:[7] });
  });
});
