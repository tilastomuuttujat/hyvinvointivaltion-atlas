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


### Valitse päätelmät: vertaileva kertomus

**Valitse vertailtavat päätelmät** avaa hakemiston, josta lukija ruksaa kaksi tai kolme päätelmää. Ruksi tarkoittaa kiinnostusta tarkasteluun, ei väitteen hyväksymistä todeksi. Haku säilyttää aiemmat valinnat, ja neljättä päätelmää ei voi lisätä. **Näytä yhteydet ja erot** aloittaa kolmivaiheisen kertomuksen:

1. Yhteinen rakenne: samat kirjatut artikkelit tai täsmälleen samat käsitesanat samalla aikakaudella. Kaikille valituille yhteinen tausta erotetaan vain pareittain löytyvistä yhteyksistä.
2. Olennaiset erot: käsittelyn aikajaksot, väitteen laji, omasta käsittelystä erottuvat käsitesanat sekä mekanismi- ja lähdekerroksen kattavuus. Kytkentämäärä ei ole vaikutus- tai luotettavuuspistemäärä.
3. Mahdollinen yhteisvaikutus: vain nykyisiin, ei-hylättyihin päätelmäsiltoihin ja kirjattuihin väitteiden suhteisiin perustuvat argumenttiyhteydet. Pelkästä yhteisestä aiheesta ei rakenneta vaikutusketjua, eikä aineistosta lasketa puuttuvaa numeerista yhteisvaikutusta.

Sama `AtlasSphere` säilyy koko ajan. Valitut päätelmät näkyvät A-, B- ja C-tunnuksin ja omilla väreillään alkuperäisissä koordinaateissa. Yhteinen tausta piirretään suuntaamattomina katkoviivoina. Erovaiheessa korostuvat omat ajalliset polut, joita ei yhdistetä aineistoaukkojen yli. Tulevaisuuden jaksot merkitään tulevaisuustarkasteluiksi. Yhteisen taustan viivoja ei käytetä yhteisvaikutusvaiheen vaikutusnuolina.

Vertailu alkaa koko aikajanalta. Sen aikavälin voi rajata pudotusvalikosta, matriisista, pallon valitusta kohdasta tai aikakausipainikkeesta valintoja menettämättä. **Mihin tämä perustuu?** avaa nykyiset artikkelikirjaukset tarkistustiloineen ja selitysrakenteen lähdehavainnot. **Tutki itse** siirtyy yhden valitun päätelmän tarkasteluun; vertailuun voi palata. **Muuta valintoja** muokkaa seuraavaa vertailua: tulos muuttuu vasta, kun uusi valinta otetaan käyttöön.

Kertomus etenee käsin tai käyttäjän käynnistämänä toistona. Laitteen reduced-motion-asetus estää automaattisen toiston. Lähteet, epävarmuus ja aineistoaukot säilyvät kertomuksen osana. Muutos käyttää samaa julkista JSONia, eikä lisää tietokantakyselyjä, kielimallikutsuja tai Neon-rakenteita.

`atlas.comparison.ts` sisältää vertailun aineistosäännöt, `ConclusionComparison.tsx` valinnan ja kertomuksen. `comparison.test.mjs` testaa muun muassa saman aikakauden vaatimuksen, tarkat käsitesanat, kolmikon ja parien eron, tarkistustilat sekä aineistoaukot. Rakennetun sovelluksen testi tarkistaa myös ruksauksen, enimmäisvalinnan, kertomuksen vaiheet, perusteet, aikarajauksen ja saman pallon säilymisen.

### Käsitekartta ja reittikartta

Akselikenttä avautuu nyt klusteroituna käsitekarttana. Lähentäminen avaa alueet → määritellyt avainkäsitteet → valitun käsitteen havainnot → valitun havainnon lähteet. Aluetta, käsitettä tai havaintoa voi myös napsauttaa tai avata näppäimistöllä. Karttaa voi siirtää vetämällä ja zoomata rullalla, nipistämällä tai painikkeilla. Mittarikenttä säilyy akselikentän alavalintana.

Valikon Reittikartta esittää saman käsitteistön aluekaistoina ja kirjatut mekanismit reitteinä. Sivupaneelissa voi seurata olemassa olevaa selityspolkua vaiheittain tai toistaa sen; vähennetty liike estää automaattisen toiston. Aikarajaus ei sijoita ajoittamattomia havaintoja keinotekoisesti kauteen. Avoimet ajoitukset ja näyttöaukot kerrotaan lukijalle.

Kartta käyttää julkisen JSON-viennin määriteltyjä käsiteklustereita, jäsenyyksiä ja nykyisiä, hylkäämättömiä mekanismeja. Nykyinen sanasto sisältää neljä klusteria ja 13 käsitettä; se ei vielä kata koko artikkelisarjaa. Useaan klusteriin kuuluva käsite näkyy kerran, muut jäsenyydet kerrotaan sisältöpaneelissa. Sijainnit ja reittien pituudet ovat navigointia, eivät vaikutusten suuruuksia. Katkoviiva ja tarkastustila erottavat ehdotetun vaikutussuunnan hyväksytystä kausaaliväitteestä. Kartan sijainti ja valinnat säilyvät näkymää vaihdettaessa; piilotetun pallon pyöritys ja kartan reittitoisto pysähtyvät.

# Yhteinen teemaluettelo ja aineistoversio

Kaikki visualisoinnit käyttävät julkisen `data/atlas.json`-viennin `themeCatalog`-osiota. Siinä on sama 12 teeman toimituksellinen luokitus sekä päätelmät, oivallukset, käsitteet, mekanismit, polut ja tutkimuskonteksti lähteineen. `src/content/teemaluettelo.json` sisältää pysyviin tunnisteisiin perustuvan toimituksellisen sijoittelun ja vanhojen vientien varanäkymän.

`npm run export:atlas` päivittää sekä havaintoaineiston että teemaluettelon samalla toistettavan lukemisen transaktiolla. Sisällöt ja lähteet haetaan tunnisteilla; nimet eivät muodosta uusia evidenssikytkentöjä. Jos uudelta käsitteeltä tai päätelmältä puuttuu toimituksellinen teemamääritys, vienti keskeytyy ja aiempi julkaisu säilyy. Lisää tällöin tarkoituksellinen teemamääritys ennen uutta vientiä.

Kirjatut mekanismit ovat suunnattuja selitysehdotuksia, eivät automaattisesti kausaalisesti vahvistettuja vaikutuksia. Ilman mekanismia olevat käsitteet näkyvät edelleen teemajäseninä. Valintapaneeli erottaa suorat havaintokytkennät toimituksellisesta tutkimuskontekstista ja näyttää puuttuvan näytön, menetelmän, ehdot ja rajaukset. Julkaisupidot säilyvät viennissä.

Testit: `npm run test:pages`, `npm run build:pages`, `npm run test:experience`. Navigoinnin vanhan pilotin regressiot käyttävät kiinteää `scripts/fixtures/pilot-atlas.json`-aineistoa; `scripts/catalogue.test.mjs` tarkistaa nykyisen julkisen aineiston kattavuuden, lähteet, suunnat ja havaintoviittausten eheyden.



## Tutkimuspolku suoraan pisteitä valitsemalla

Teemaverkossa ja solmuverkossa käsitteen valinta vihjaa heti seuraavat pisteet: katkokehät ja pienet suuntanuolet osoittavat kirjatut viereiset mekanismit. Lyhyt tausta-/seurausvihje näkyy osoitettaessa tai näppäimistökohdistuksessa; kosketuslaitteella se näkyy suoraan. Kysymysvalikkoa tai automaattista tekstilaatikkoa ei avata.

Seuraavan pisteen klikkaus jatkaa polkua. Valitut pisteet numeroidaan tutkimisjärjestyksessä, valitut mekanismit vahvistuvat yhtenäisiksi viivoiksi ja vaihtoehtoiset jatkot jäävät kevyiksi katkoviivoiksi. Nuoli säilyttää kirjatun vaikutussuunnan myös taaksepäin tutkittaessa. Aiemman valitun pisteen klikkaus tai Edellinen palauttaa polkua ja mahdollistaa uuden haaran. Muu piste aloittaa uuden polun. Tyhjennä polku poistaa korostukset.

Jatkoja ei päätellä teemajäsenyydestä tai samankaltaisuudesta. Nykyiset hylkäämättömät mekanismit ja väitteet sekä puuttuvat jatkot säilyttävät aineistonsa tilan. Vihje ei vahvista syy-yhteyttä. Pitkät perustelut ja lähteet ovat edelleen käyttäjän erikseen avaamassa tietolaatikossa. Polku on näkymän istuntotilaa, eikä sitä tallenneta tietokantaan.


### Virtaavat jatkoviivat ja oma polkuyhteenveto

Ensimmäisestä käsitevalinnasta lähtien kirjatut jatkot näkyvät kaarevina, vaikutussuuntaan virtaavina viivoina. Jokaisella avoimella jatkolla on kuvaajassa mekanismin nimi ja lyhyt kuvaus ennen valintaa. Kuljettu polku pysyy vahvempana; liikkeen vähennysasetus pysäyttää virtauksen.

Oma polku -painike avaa erillisen liukuvan yhteenvedon. Se näyttää aloituksen, valitut vaiheet, kunkin yhteyden selityksen, kirjatun vaikutussuunnan ja mahdollisen taaksepäin tutkimisen. Ehdot, rajat ja suorat havaintolähteet ovat yhteyden omassa lisätiedossa. Paneeli päivittyy etenemisen ja palaamisen mukana, mutta ei avaudu itsestään. Alkuperäinen tietolaatikko ja polkuyhteenveto avataan vuorotellen, jotta ne eivät peitä toisiaan.


### Yhteinen tutkimusreitti ja valintojen esikatselu

Teemaverkko ja solmuverkko käyttävät samaa tutkimusreittiä. Näkymän vaihto säilyttää käsitteen, valitun mekanismin ja navigointihistorian. Edellinen ja Eteenpäin palauttavat täsmälliset valinnat; myös uuden aloituksen ja tyhjentämisen voi perua. Taustan klikkaus tai aiheen selaaminen ei tyhjennä reittiä.

Seuraava askel -valikon osoitus tai näppäimistökohdistus esikatselee juuri kyseistä mekanismia. Kuvaajan pisteen osoitus korostaa siihen johtavat vaihtoehdot. Kaikilla jatkoilla on lyhyt kuvaus; esikatselu avaa tarkemman selityksen samalle viivalle. Jos kahden pisteen välillä on useita mekanismeja, suora pistevalinta pyytää valitsemaan kirjatuista yhteyksistä eikä käytä ensimmäistä löytyvää. Valikon valinta säilyttää mekanismin pysyvän tunnisteen.

Kuljetut mekanismit piirretään myös sen jälkeen, kun ne eivät enää ole nykyisen pisteen välittömiä jatkoja. Molemmat kuvaajat sovittavat valitun polun pisteet ja nykyisen pisteen välittömät jatkot näkyviin ensisijaisesti pienellä siirrolla, tarvittaessa loitonnuksella. Eteneminen ei kierrä teemataivasta uudelleen. Jokaisen näkymän kamera säilyy erikseen.

Oma polku -yhteenveto kertoo myös tutkimissuunnan, selitysehdotusten määrän ja havaintokytkentöjen puutteet. Se ei muodosta uusia päätelmiä yhteyksien yhdistämisestä. Reitti ja historia säilyvät tämän sivun istunnon ajan; ne eivät tallennu tietokantaan tai selaimen pysyvään tallennustilaan.


## Laajempi Neon-julkaisumalli ja tilannekohtainen polku

Selain lukee edelleen yhtä `data/atlas.json`-julkaisua. Uusi valinnainen `publication`-osa (malliversio 1) sisältää julkaistavat teemajäsenyydet, päätöstapaukset, tapausreitit, palvelukehykset ja -siirtymät, vastuut, mittarimääritelmät, vertailut, aineistoaukot sekä tilastosarjojen määritelmät ja ulottuvuudet. Palvelumenettely ei muutu kausaaliseksi mekanismiksi. Mittarimääritelmä ei ole mitattu havainto.

`export-atlas.mjs` lukee perusaineiston, toimitukselliset oivallukset ja `export-publication.sql`-osan samassa toistettavan lukemisen, vain lukevassa transaktiossa. Julkaisuosa rajataan perusviennin julkaistuihin havainto-, polku- ja evidenssitunnisteisiin. Hylätyt ja vanhentuneet viitteet sekä julkaisemattomiin havaintoihin viittaavat rivit eivät tule mukaan. Artikkelien tekstejä, raakatuonteja ja yksityisiä lähdesnapshotteja ei viedä. Viite- ja versiotarkistus keskeyttää epäkelvon viennin ennen tiedoston vaihtoa.

Neonin `editorial_synthesis_12_v1`-luokituksen nimet ja julkaistavat käsitejäsenyydet ovat ensisijaisia. Sama käsite voi kuulua useaan teemaan, mutta solmuverkossa sillä on yksi pysyvä tunniste. Käsitteelle, jolla ei ole tietokannan teemakirjausta, säilytetään merkitty aiempi toimituksellinen sijoittelu. Pelkästään hylättyä jäsenyyttä ei elvytetä varamäärityksellä: vienti vaatii korvaavan määrityksen. Alkuperäinen 32 teeman aineisto ei muutu tämän 12 teeman toimitukselliseksi luokitukseksi.

**Rajaa tilannetta** antaa valita vuodet 1850–2050, havaintoihin kirjatun kohderyhmän ja tapauksen. Kirjatun aikarajauksen ulkopuolista tai valittuun julkaistuun tapausreittiin kuulumatonta mekanismia ei jatketa vahingossa. Erilliset ajanjaksot tai varmistamaton kohderyhmän vastaavuus vaativat nimenomaisen tarkastelutilanteen vaihdon; se kirjataan polun yhteenvetoon. Avoin ajoitus ja tekstimuotoiset ehdot näytetään avoimina, ei automaattisesti täyttyvinä. Tekstiehtojen loogista yhteensopivuutta ei päätellä avainsanoista tai samankaltaisuudesta.

**Tutki perustetta ja lähteitä** avaa erillisen, käyttäjän hallitseman porautumisen: mekanismi → väite → tukeva/haastava/rajaava havainto → lähdekortti. Argumenttisuhteet pysyvät erillään kausaalisista mekanismeista. Tapaukset, palveluvaiheet, vastuut, määritellyt mittarit, vertailuasetelmat, sarjojen menetelmät ja aineistoaukot löytyvät samasta taustatarkastelusta. Niitä ei liitetä mekanismiin nimen samankaltaisuuden perusteella.

Julkaistavat tapausreitit voivat olla pienempi joukko kuin tietokannan kaikki reitit: esimerkiksi hylätty vaihe tai puuttuva ajantasainen mekanismi katkaisee julkaisemisen. Viennin `exclusions` ilmoittaa pois jääneiden reittien ja palvelusiirtymien lukumäärät paljastamatta niiden sisältöä.

### Automaattinen aineistopäivitys

Pages-työnkulku lukee Neonin uuden julkaisun jokaisessa päähaaran pushissa ja päivittäin kello 04.17 UTC. Manuaalisen ajon `refresh_data` on oletuksena true; eksplisiittinen false käyttää repositorion aiempaa snapshotia. PR-ajot käyttävät vain repositorion aineistoa eivätkä saa tietokantasalaisuutta. Uusi vienti validoidaan, testataan ja rakennetaan ennen Pages-julkaisua. Epäonnistunut ajo ei korvaa toimivaa Pages-julkaisua. Aineistotiedostoja ei commitoida automaattisesti takaisin päähaaraan.

`data/atlas-version.json` julkaistaan saman koonnin mukana. Selain tarkistaa viiden minuutin välein, onko uudempi vienti saatavilla, ja tarjoaa käyttäjälle latauspainikkeen. Aktiivista aineistoa tai käyttäjän polkua ei vaihdeta taustalla, eikä eri vientien osia yhdistetä.

Testit: `npm run test:pages`, `npm run build:pages`, `npm run test:experience`. `scripts/fixtures/publication.json` ja sitä vastaava `publication-input.json` ovat 15.11.2026 tallennettuja, julkaistaviin tunnisteisiin rajattuja testiaineistoja (syötteessä on 39 testattavien lähdeketjujen havaintoa); sitä ei kopioida sivuston julkiseen hakemistoon. Varsinainen yhtenäinen julkaisu muodostuu luotetussa vientiajossa.

### Vaikutusketjut

Erillinen **↝ Vaikutusketjut**-välilehti avautuu myös osoitteen päätteellä `#vaikutusketjut`. Aloituspisteen voi hakea, valita esimerkeistä tai kokonaiskartasta. Seuraukset, taustatekijät ja 1–3 askeleen esikatselu näyttävät vain aineistoon kirjatut, voimassa olevat mekanismit. Kauempana näkyviin pisteisiin edetään väliaskeleiden kautta. Rinnakkaiset mekanismit säilyvät erillisinä valintoina.

Valittu reitti korostuu samassa kuvaajassa. Vedä, lähennä tai käytä pienoiskarttaa kokonaisuuden seuraamiseen. Teemavärit perustuvat yhteiseen teemaluokitukseen; myös käsitteet ilman mekanismia ovat mukana. Niiden teemajäsenyys ei muodosta vaikutusyhteyttä. Solmujen paikat pysyvät samoina porautuessa: sijainti, etäisyys ja viivan pituus eivät mittaa aikaa tai vaikutuksen voimakkuutta. Nuolenkärki näyttää aina kirjatun vaikutussuunnan myös taustatekijöitä tutkittaessa. Katkoviiva erottaa ehdotetut yhteydet hyväksytyistä kausaalisista yhteyksistä, ja vahva viiva ilmaisee lukijan valitseman reitin, ei koko ketjun todistusvoimaa.

Oma polku, tarkastelurajaukset sekä perustelut ja lähteet avautuvat vain painikkeista. Polku säilyy teemaverkkoon ja solmuverkkoon siirryttäessä. Aikajana 1850–2050 näyttää vain kirjattujen väitteiden ajoitukset ja ilmoittaa avoimet ajoitukset. Näkymä käyttää samaa versionoitua julkista JSON-vientiä ja yhteistä tutkimuspolkua kuin muut näkymät; uusia tietokantakyselyitä tai pääteltyjä syy-yhteyksiä ei lisätä.


### Visuaalinen vaikutusketjujen löytäminen Päättelyavaruudessa

Päättelyavaruudessa navigoidaan pyörittämällä ja valitsemalla verkosta. Suuntaan nähden etualalla oleva kirjatun mekanismin aloituspiste korostuu, ja sen 1–3 askeleen haarat erottuvat virtaavina viivoina. Pyörittäminen häivyttää edellisen esikatselun ja tuo uuden tilalle. Pieni vaihtokynnys estää ketjujen välkkymisen rajalla. Suuntamuutos ei lisää askeleita lukijan polkuun. Esikatselut rajataan enintään seitsemään kirjattuun mekanismiin: ne eivät väitä kattavansa kaikkia seurauksia.

Aloitus- ja jatkovalikoita ei näytetä. Ketjun alun voi valita pisteestä ja jatkaa pisteitä tai mekanismiviivoja pitkin. Rinnakkaiset mekanismit valitaan erillisistä nimetyistä viivoista. Nuoli ja virtaussuunta säilyttävät kirjatun vaikutussuunnan. Teemajäsenyys ei muodosta vaikutusaskelta. Tekstit käyttävät 12 teemaväriä; taustanimikkeet säilyvät piilossa. Asetelmaa voi pyörittää myös nuolinäppäimillä. Vähennetyn liikkeen asetuksella automaattinen pyörintä ja virtausanimaatiot poistuvat, mutta staattinen korostus ja nuolenkärjet säilyvät.

**Oma tulkintapolku** avataan painikkeesta. Se kokoaa ajoitukset 1850–2050, havaintoihin kirjatut kohderyhmät, mekanismien ehdot ja rajaukset, tukevat/haastavat/rajaavat/taustoittavat havaintokytkennät, tutkimusasetelmat ja lähteisiin porautumisen. Väitteiden argumenttisuhteiden suunta säilyy. Puuttuva havaintokytkentä tai kilpaileva argumentti kerrotaan puutteena. Ajoitus ja kohderyhmät eivät automaattisesti tee askelista yhteismitallisia.

Yhden polun voi säilyttää ja tutkia toista samasta lähtökohdasta. Vertailu näyttää tarkan yhteisen alkuosan (myös mekanismitunnisteet) ja molempien polkujen aineistopohjan. Vertailu säilyy nykyisen Päättelyavaruuden avaamisen ajan. Näyttölukumäärät eivät ole näytön vahvuuspisteitä, eikä ketjun kokonaisvaikutusta päätellä paikallisista yhteyksistä. Kaikki tiedot tulevat samasta staattisesta julkaisusta.


### Historiallinen aikaseinä

Päättelyavaruuden taustalla on kiinteä aikaseinä 1850–2050. Pisteet näyttävät tapahtumia ja viivat kirjattuja aikavälejä. Näkymän rajaa aiemmin alkaneet ilmiöt merkitään katkaistulla alulla; alkuperäinen ajoitus säilyy lähdekortissa. Pyörittäminen valaisee aktiivisen ketjun aihealueisiin ja kirjattuihin aikaikkunoihin sopivia ilmiöitä. Avoin ketjun ajoitus ei muutu varmistetuksi yhteiseksi ajankohdaksi. Lähentäminen paljastaa lisää kohteita samoissa päiväysperusteisissa paikoissa. Nimikkeet rajataan ja päällekkäisyyksiä vähennetään. Ilmiön valinta korostaa sen, ja erillinen Ajoitus ja lähteet -painike avaa tiedot.

Aineisto on 15.11.2026 Supabasen murrosmatriisi-projektin public.items-taulusta vain lukien koottu, versionhallittu vienti: 1 111 ajoitettua, julkiseksi merkittyä kohdetta, jotka leikkaavat aikaikkunaa 1850–2050. Mukana ovat alkuperäiset tunnisteet, otsikot, aikavälit, tyypit, aihealueet, tärkeys-/luottamusmerkinnät ja lähdeviitteet. Lähdeviitteen esiintyminen ei osoita, että sen sisältö olisi tässä työssä tarkistettu. Skenaariot ja tulevat alkamisvuodet erotetaan ilmeessä ja tietokortissa.

Tiedosto src/content/history-wall.json on erillinen historiallinen aineistoversio, jonka päiväys näytetään tietokortissa; se ei ole automaattisesti päivittyvä osa Neon-vientiä. Selain ei ota yhteyttä Supabaseen tai Tursoon. Uusittava vain julkisista riveistä scripts/export-history.sql-kyselyllä ja tarkistettava testein. Neonin päiväajon aineistoversion ei väitetä olevan tämän historiallisen lähteen päivityspäivä.

Aihealueluokitus 12 näyttöteemaan on eksplisiittinen toimituksellinen domain-ryhmittely atlas.history.ts-tiedostossa. Se ei muodosta käsite- tai mekanismisiltaa. Nyt tuodussa aineistossa ei ole hyväksyttyjä kytkentöjä vanhoista Supabase-mekanismitunnisteista nykyisiin Neon-mekanismitunnisteisiin. Siksi valaistut yhdysviivat ovat pisteviivaisia taustayhteyksiä. Mahdollinen tuleva mechanismLinks-kytkentä on validoitava täsmällisellä nykyisellä mekanismitunnisteella, lähteellä, perustelulla ja accepted-merkinnällä; silloinkin suhde tarkoittaa dokumentoitua kontekstia, ei kausaalivahvistusta.


Aikaseinän asettelu on käytävämäinen: historialliset ilmiöt ja niiden aikavälit ovat vain vasemmalla (x < 320) tai oikealla (x > 1280) 1600-yksikön kuva-alassa. Myös otsikot ja pyynnöstä avattava lähdekortti pysyvät sivuseinillä. Keskiosa on varattu käsiteverkolle; siellä kulkee enintään kaksi hyvin heikkoa, hitaasti virtaavaa yhteysviivaa ilmiöihin. Muut ilmiöt jäävät himmennetyiksi. Vuodet 1850–2050 etenevät molemmilla sivuilla ylhäältä alas; vinous kuvaa käytäväperspektiiviä, ei vaikutuksen suuruutta.
