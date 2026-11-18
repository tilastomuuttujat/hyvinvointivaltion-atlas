type Observation = {
  label: string;
  chain: string;
  source: string;
  years: readonly [number, number];
  points: readonly [string, string];
};

export const STAGE_OBSERVATIONS: Partial<Record<string, { strength?: Observation; difficulty?: Observation }>> = {
  "2:1856": {
    strength: { label: "Uusia kulkuyhteyksiä", chain: "liikenne-kanavat-rautatiet",
      source: "h12-ev-state-h12-liikenne-kanavat-rautatiet-s1",
      years: [1856, 1862], points: ["Saimaan kanava", "Helsinki–Hämeenlinna-rata"] },
  },
  "3:1917": {
    strength: { label: "Mahdollisuus oman tilan lunastamiseen", chain: "torpparivapautus-1918",
      source: "tp-e-transition0", years: [1918, 1922], points: ["Lunastuslaki", "Lunastusten toimeenpano"] },
  },
  "3:1945": {
    strength: { label: "Maata asuttamiseen", chain: "karjalan-siirtovaen-asuttaminen-1940",
      source: "ks-e-t3", years: [1944, 1945], points: ["Uusi evakuointi", "Maanhankintalaki"] },
    difficulty: { label: "Maaseudun ja kaupunkien tarpeet erosivat", chain: "karjalan-siirtovaen-asuttaminen-1940",
      source: "ks-e-groups", years: [1944, 1945], points: ["Evakkoon eri lähtökohdista", "Kaupungeissa työ ja asunto"] },
  },
  "3:1968": {
    strength: { label: "Yhteinen koulupolku laajeni", chain: "peruskoulu-uudistus-1968",
      source: "pk-e-s2", years: [1968, 1977], points: ["Laki 467/1968", "Yhteinen peruskoulu käyttöön"] },
    difficulty: { label: "Tasokurssit rajasivat jatko-opintoja", chain: "peruskoulu-uudistus-1968",
      source: "pk-e-s3", years: [1972, 1985], points: ["Tasokurssit käytössä", "Tasokursseista luovuttiin"] },
  },
  "4:1986": {
    strength: { label: "Luotonsaannin ehdot väljentyivät", chain: "rahoitusmarkkinoiden-vapauttaminen-1980",
      source: "rf-e-s1", years: [1983, 1987], points: ["Korkosääntelyä purettiin", "Valuuttasääntely keveni"] },
    difficulty: { label: "Velanhoito vaikeutui kriisissä", chain: "rahoitusmarkkinoiden-vapauttaminen-1980",
      source: "rf-e-mechanism", years: [1986, 1993], points: ["Velkaa kertyi", "Korko- ja valuuttariskit toteutuivat"] },
  },
};
export type ObservationKind = "strength" | "difficulty";
