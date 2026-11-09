# Hyvinvointivaltion Atlas (1850–2050)

Suomen hyvinvointivaltion kehityskaarta, nykytilaan johtaneita syitä ja tulevaisuuden näkymiä avaava pallomainen atlasvisualisointi.

Aineisto pohjautuu Neonin artikkeli-, havainto- ja selitysrakenteisiin (38 artikkelia, 53 päätelmää ja 7 aikakautta).

## Teknologia

- TanStack Start (SSR & server functions)
- React 19
- TypeScript
- Tailwind CSS v4
- Neon PostgreSQL connector gateway

## Kehitys

```sh
npm install
npm run dev
```


## GitHub Pages — staattinen lukuversio

1. Avaa **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. Yhdistä Pages-muutokset `main`-haaraan. `Publish Atlas to GitHub Pages` rakentaa ja julkaisee sivun.
3. Osoite on `https://tilastomuuttujat.github.io/hyvinvointivaltion-atlas/`.

Pages-versio käyttää `public/data/atlas.json`-aineistovientiä. Sivun käyttö ei tee tietokantakyselyjä. Mukana toimitetaan nykyinen aineistovienti; ensimmäinen julkaisu ei tarvitse salaisuuksia. Alkuperäinen TanStack Start -palvelinversio säilyy (`npm run dev` / `npm run build`). Pages-versio käynnistyy `npm run dev:pages` ja rakentuu `npm run build:pages` → `dist-pages/`.

### Aineiston päivittäminen

Lisää **Settings → Secrets and variables → Actions** -kohtaan salaisuus `NEON_DATABASE_URL` (mieluiten vain lukuoikeuden sisältävän roolin PostgreSQL-yhteysmerkkijono). Älä lisää tunnusta VITE_-muuttujaan tai lähdekoodiin.

Valitse **Actions → Publish Atlas to GitHub Pages → Run workflow → main** ja ruksaa **Refresh the public JSON snapshot from Neon**. Vienti ja julkaisu tapahtuvat samassa ajossa; päivittynyt JSON on julkaisuartifaktissa, ei automaattisena Git-commitina. Tavallinen push käyttää repositorion talletettua snapshotia. Jos haluat säilyttää uuden viennin myös repositoriossa, suorita `npm run export:atlas` paikallisesti ympäristömuuttujalla `NEON_DATABASE_URL` ja commitoi vain `public/data/atlas.json`.

Vienti on vain luku -transaktio ja julkaisee vain SQL-tiedostossa luetellut julkisen lukuversion kentät. Mukana ovat myös toimitukselliset, tarkistusta odottavat kytkennät: tarkistustila näkyy kortissa. Hylätyt ja vanhoihin revisioihin perustuvat linkit jätetään pois. Kuvaajan kytkentämäärä ei ole vaikutuksen voimakkuus tai kausaalinen näyttö.

`npm run test:pages` tarkistaa JSONin viitteet, koontilukujen vastaavuuden yksittäisiin kytkentöihin ja tunnusten puuttumisen aineistosta. Peruspolku on `/hyvinvointivaltion-atlas/`; repositorion nimen vaihtuessa workflow käyttää uutta nimeä. Mukautetulle verkkotunnukselle käytä `PAGES_BASE_PATH=/`.

### Yhtenäinen Atlas-pallo

Pituusaste perustuu aikakauteen (1850–2050), leveysaste järjestää päätelmät ja kerros erottaa taustoittavat, suorat ja vastanäyttökytkennät. Maaston korkeus kuvaa toimituksellisten artikkelikytkentöjen tiheyttä. Se ei mittaa yhteiskunnallisen ilmiön voimakkuutta tai kausaalista vaikutusta.

Tarinakatsaus ja aikakone tarjoavat historiallisen lukureitin. Palloa voi pyörittää vetämällä tai nuolinäppäimillä, lähentää rullalla tai nipistämällä sekä +/−-säätimillä. Valitsemalla Tutki selityksiä tai lähentämällä avataan valittuun kysymykseen liittyvä määritelty sanasto. Lähteistetyn esimerkkipolun painike käynnistää nykyisen selityspilotin.

Artikkelien vapaat käsitemerkinnät ja määritelty käsitesanasto erotetaan. Niiden välille piirretään yhteys vain nykyisen kirjauksen perusteella. Yksityiskohtaiset zoomaussäännöt on kuvattu alla.

### Yhteyksien perusteet ja tarkistustilat

Päätelmien välinen kaari tarvitsee samalla aikakaudella vähintään yhden yhteisen artikkelin tai täsmälleen vastaavan kirjatun avainkäsitteen. Pelkkä esiintyminen samalla aikakaudella ei riitä. Käsitesanoista verrataan Unicode-normalisoitua, reunaväleistä siivottua ja pienaakkostettua tekstiä; synonyymejä ei päätellä eikä vapaita käsitesanoja esitetä vielä yhtenäistettyinä käsite-ID:inä. Yhteinen artikkeli ei välttämättä tarkoita yhteistä havaintoa tai tekstinäytettä. Kaari on asiayhteys, ei kausaalinen vaikutuspolku.

Yhteyskorteissa näytetään peruste (artikkelinumerot ja/tai käsitesanat), ja niistä voi avata toisen päätelmän saman aikakauden käsittelyn. Kuvaajassa näytetään enintään 14 yhteyttä. Tietokenttä tarjoaa kirjatuista asiayhteyksistä etenemisvaihtoehtoja. Aikajana ei yhdistä aineistoaukkojen yli. Puuttuvat jaksot luetellaan erikseen ja ne riippuvat nykyisestä lajien ja kerrosten rajauksesta.

Pallon ja käsittelypaneelin aikakausivalinta on yhteinen. Artikkelikorteissa näkyvät tarkistustila, rajaukset ja kirjatut käsitteet. Sivun alareunassa näkyvät JSON-viennin ajankohta ja tarkistusperiaate. Sekä palvelinversio että Pages-vienti käyttävät samaa nykyisiin revisioihin rajattua SQL-vientiä.

### Havaintoaineisto

Avainkäsitteittäin avattava havaintoluettelo käyttää samaa julkista JSONia kuin pallo. `evidence` sisältää määritellyn sanaston, tilastohavainnot, tutkimustulokset ja niiden kytkennät. Se on erillinen pallon vapaamuotoisista artikkelikäsitteistä. Pallon aikakausisuodatin ei rajaa luetteloa.

Vienti jättää pois julkaisukiellossa olevat ja julkaisemattomiksi merkityt tilastohavainnot sekä hylätyt kytkennät. Tutkimusten epätarkat ajoitukset ja kuukausitietojen viiteajat säilyvät. Artikkeliviitteissä näkyvät hyväksyntä ja revisioiden ajantasaisuus; viitettä ei tulkita päätelmän näytöksi. Lähdearvojen peritty tarkistustila säilyy, eikä vienti tee uutta lähdevarmennusta. Tyhjät käsitteet näkyvät havaintoaukkoina.

Nykyinen havaintokerros: 13 käsitettä, 284 havaintoa, 519 kytkentää; 30 havaintoa pidätetty. Päivitä koko snapshot olemassa olevalla `export:atlas`-komennolla tai Pages-työnkulun refresh-valinnalla.


### Selitysrakenne: lähteestä väitteeseen

`atlas_reasoning` täydentää olemassa olevaa havaintokerrosta. Rakenne erottaa:

- klusterit ja monijäseniset avainkäsitteet;
- yhtenäisen lähderekisterin ja havaintokohtaisen lähdekohdan;
- täsmälliset väitteet, hypoteesit, synteesit, arviointiperiaatteet ja skenaariot;
- havainto → tukee / haastaa / rajaa / taustoittaa → väite -kytkennät;
- väitteiden väliset perustelut ja oletukset;
- käsitteiden väliset mekanismit, niiden ehdot ja näytön lajin;
- erikseen perustellut yhteydet aiempiin päätelmiin;
- järjestetyt, käsitteiden kautta etenevät selityspolut.

Lähdevarmennus, näytön soveltuvuus ja toimituksellinen hyväksyntä ovat erillisiä. Kaikki pilotin uudet tulkinnat ovat `needs_review`; alkuperäisiä hyväksyntöjä ei muuteta. Pilotin yhteys päätelmään 25 on taustayhteys. Kustannussäästö jää hypoteesiksi, jota työhönpaluututkimus ei yksin osoita.

Neoniin on viety neljä klusteria, 16 jäsenyyttä, 314 havaintojen lähdeviitettä, kolme väitettä, kaksi evidenssisuhdetta, kaksi mekanismia ja yksi kolmivaiheinen pilottipolku. Julkisessa snapshotissa on edelleen 284 havaintoa; 30 pidätetyn havainnon lähdeviitteitä ei viedä. Julkinen lähderekisteri sisältää vain näkyvien havaintojen lähteet. Tilastolähteiden nimet ovat aluksi perittyjä URL-tunnisteita; niitä ei ole bibliografisesti täydennetty eikä lähdearvoja tarkistettu uudelleen.

`evidence.reasoning` on valinnainen, versionumeroitu laajennus. Vanha JSON pysyy luettavana. Havaintonäkymässä voi rajata klusterin, seurata pilotin vaiheita ja avata väitteiden perustelut. Pallon lähdepolku käyttää tätä rakennetta; alkuperäiset havainnot ja tulkintojen hyväksynnät säilyvät erillisinä. Sanastoa ei yhdistetä automaattisesti pallon vapaatekstikäsitteisiin.

#### Hallittu käyttöönotto

1. Testaa migraatio tuotannosta luodulla Neon-haaralla.
2. Aja `NEON_DATABASE_URL=… npm run migrate:reasoning` ensin testihaaralle ja sitten kohdehaaraan. Yhteys tarvitaan vain palvelimessa. Migraatio on lisäävä ja transaktionaalinen, tarkistussummat estävät jo ajetun migraation hiljaisen muuttamisen.
3. Tarkista `database/verify-reasoning.sql`. `database/check-reasoning-constraints.sql` on tarkoitettu vain testihaaraan.
4. Aja `npm run export:atlas`, `npm run test:pages` ja `npm run build:pages`.

Sisältömuutokset kasvattavat lähteen tai väitteen revisiota automaattisesti. Kytkentöihin tallennetaan perustana oleva revisio ja havainnon lähdetietueen tiiviste. Vanhentuneet, hylätyt ja julkaisukiellossa olevaan havaintoon liittyvät evidenssikytkennät suodatetaan viennistä. Muuttuneisiin väitteisiin perustuvaa polkua ei viedä osittaisena. Vanha artikkelikytkentä ei muutu hyväksytyksi näytöksi.

`export-reasoning.sql` on viennin kanoninen alikysely, joka on upotettu `export-atlas.sql`:ään, jotta palvelin ja Pages käyttävät samaa yhden kyselyn snapshotia. Testi tarkistaa niiden yhtäpitävyyden. Uusi sisältö ja siihen liittyvät kytkennät lisätään uutena siemen-/migraatioversiona; jo ajettuja tiedostoja ei muuteta.


### Tasoittain avautuva pallonavigointi

Kokonaiskuva, ilmiöalue, avainkäsite, selitys, havainto ja lähde ovat saman pallon tarkastelutasoja. Navigoinnin sisältösäännöt ovat `atlas.navigation.ts`:ssä ja niiden kytkentä pysyvään karttaan `atlas.investigation.ts`:ssä. `AtlasNavigator.tsx` on erillisen aiemman esityksen komponentti; päänäkymä käyttää suoraan samaa sisältölogiikkaa ilman toista palloa.

### Kysymyslähtöinen zoomaus samalla pallopinnalla

`AtlasExperience` käyttää yhtä pysyvää `AtlasSphere`-instanssia. Zoomaus paljastaa ilmiöalueita, määriteltyjä käsitteitä, väitteiden perusteluja, havaintoja ja lähteitä saman maaston päällä. Tasojen välinen pieni hystereesi estää tiedon välkkymisen raja-arvojen lähellä. Loitontaminen rajaa näkyvän sijaintipolun mutta säilyttää syvän valinnan; takaisin lähentäminen palauttaa saman kohteen. Tavallinen tasonvaihto ei muuta kameran suuntaa eikä luo uutta palloa. Esimerkkipolun nimenomainen käynnistäminen kohdistaa tutkimuksen päätelmään ja aikakauteen.

Älykkyys on selitettävää aineiston käyttöä, ei kielimallin arvausta. `atlas.investigation.ts` yhdistää valitun kysymyksen, aikakauden, ajantasaiset evidenssisuhteet ja nimenomaiset päätelmäsillat. Kirjattuja väitteiden suhteita voi kulkea asiayhteyksien löytämiseksi; kulku ei tarkoita kausaalisen näytön periytymistä. Määritelty sanasto ja artikkelien vapaat käsitemerkinnät pysyvät erillisinä.

Pallon lisämerkinnöillä on tietueen tunnisteesta deterministisesti määräytyvät paikalliset koordinaatit päätelmän aikakausikohdan ympärillä. Järjestys, zoom ja kysymys eivät siirrä samoja tietueita uusiin paikkoihin. Kirjattu mekanismi saa etusijan aiheeseen vain liittyvään väitteeseen nähden, ja rajaavat tai haastavat havainnot säilyvät näkyvyysjärjestyksessä. Merkintöjä karsitaan kuvaruudun koon, etupuolisuuden ja päällekkäisyyksien perusteella. Kaikki seuraavat perustelut ovat silti avattavissa saman tietokentän luettelosta.

Jos nykyistä päätelmäsiltaa, aikakauden artikkelikäsittelyä tai täsmällistä havaintojaksoa ei ole, kohdetta ei sijoiteta kronologiselle pinnalle. Se merkitään erilliseksi tietokentässä. Puuttuvaan kysymysketjun valintaan pysähdytään myös suurella zoomilla: sovellus ei valitse väitettä lukijan puolesta. Nykyisessä aineistossa lähteistetty polku kattaa rajatun pilotin; laajempi peitto edellyttää lisää tarkistettuja siltoja ja mekanismeja.

Aikakone säilyttää valitun kysymyksen ja lähdepolun; aikarajauksen ulkopuolisuus näytetään myös lähdetasolla. Historiallisen tarinan uuden luvun valinta aloittaa uuden päätelmäkontekstin. Vanhat karttakohteen valinnat tyhjennetään ajan tai päätelmän vaihtuessa. Maaston tiheyden merkitys näkyy jatkuvasti selitteessä.

Artikkeliperustelut näyttävät kaikki nykyisen aikakauden osumat, mukaan lukien vastanäytön ja tarkistustilan. Palvelinlukija käyttää jälleen samaa `export-atlas.sql`-kyselyä kuin julkinen JSON: artikkeli-, runkotiiviste- ja päätelmärevision ehdot sekä hylkäyssuodatukset ovat samat. Yhteys kulkee olemassa olevan Lovable-gatewayn kautta; selain lukee edelleen staattista snapshotia. Uusia tietokantatauluja, tunnuksia tai mallikutsuja ei tarvita.

HUD:n kohdistuksen ja perustelutekstin päivitykset eivät käynnistä maaston uudelleenprojektiota: pysyvä pallo on muistettu komponentti ja sille välitetyt tapahtumat sekä tutkintataso vakautetaan. Kamera renderöityy normaalisti pyöritettäessä ja zoomattaessa.

`npm run test:experience` tarkistaa rakennetun Pages-sovelluksen DOM-ympäristössä: kaikki artikkeliperustelut, kuusi tietotasoa, alkuperäislähteen avaamislinkin, saman pallon säilymisen, loitonnuksen/lähennyksen muistaman kontekstin ja muuttuneen aikarajauksen varoituksen. Aja sitä ennen `npm run build:pages`. Pages-työnkulku suorittaa tarkistuksen ennen julkaisuartifaktin lähettämistä. Testin jsdom-riippuvuus on vain kehityskäyttöön, eikä sitä sisällytetä selainpakettiin. DOM-testi ei korvaa oikean selaimen visuaalista tai kosketuseletestiä.
