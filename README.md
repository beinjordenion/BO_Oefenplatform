# Oefenplatform Boekhouden

## Wat zit erin?
- Startpagina en navigatie geïnspireerd op de publiek zichtbare opbouw van Boekhoudenoefenen.be.
- Modules: numeriek klavier, factuurberekening, loonberekening, dubbel boekhouden, creditnota en documentenstroom.
- Startpagina met een overzicht van leerdoelen en een link naar alle oefeningen.
- Factuurberekening met zes niveaus: de leerkracht maakt oefeningen met één of meer btw-tarieven, goederenprijzen, kortingen, kosten en verpakking. Het niveau wordt bepaald door de gebruikte factuuronderdelen, niet door verschillen tussen btw-regels. Het niveau en de antwoorden worden automatisch berekend. Leerlingen starten zelf een opgave en vullen de lege tabel per btw-tarief aan.
- Creditnota berekenen werkt met dezelfde oefenopbouw als factuurberekening: per btw-tarief kunnen goederen, handelskorting, extra kosten, financiële korting en verpakking worden opgegeven. Leerlingen vullen de creditnota aan en krijgen antwoordcontrole en een uitwerkingstabel.
- Leerkrachtbeheer per onderdeel: kies eerst een onderdeel om oefeningen toe te voegen, bewerken, verwijderen en bewaren. Importeren en exporteren is per gekozen onderdeel.
- Leerkrachten kunnen beschikbare oefenmodules voor leerlingen in- of uitschakelen. Een module zonder oefeningen is automatisch niet beschikbaar.
- Numeriek klavier is een vaste snelheidstest met tien willekeurige getallen van € 0,00 tot € 9.999,99. Leerkrachten kunnen de module in- of uitschakelen, maar maken er geen oefeningen voor aan. Na een volledige test verschijnt de tijd in seconden; de drie snelste tijden blijven tijdens het openstaan van de website bewaard.
- Bij het starten kiest de gebruiker eerst voor leerling of leerkracht. Leerlingen importeren een oefeningenset voordat ze naar de startpagina gaan; leerkrachten melden zich aan met de leerkrachtcode.
- De standaard oefenbank is leeg en alle modules staan standaard uit. Na import door een leerling wordt de module van de geïmporteerde set ingeschakeld.
- Geïmporteerde oefeningen krijgen een unieke, opeenvolgende naam op basis van de bestaande namen. Facturen krijgen een titel zoals `F0001-JJJJ`; creditnota's krijgen `CN0001-JJJJ`, waarbij `JJJJ` het huidige jaar is. Bij handmatig bewaren wordt een dubbele naam automatisch uniek gemaakt.
- Importeren voegt oefeningen toe aan de bestaande oefenbank; een ID-botsing krijgt een nieuwe unieke ID en overschrijft of verwijdert de bestaande oefening niet.
- Toevoegen/bewaren en verwijderen vragen bevestiging via een dialoogvenster in de huisstijl.
- Succesvolle imports en importfouten tonen meldingen in hetzelfde dialoogvenster; de leerling bevestigt daar om door te gaan naar de startpagina.
- De merknaam bovenaan brengt leerlingen terug naar de startpagina; in de leerkrachtrol blijft het beheer geopend.
- Beide rollen kunnen via **Uitloggen** terugkeren naar de rolkeuze; de gebruiker moet de uitlogactie bevestigen. Na bevestigde uitlog door een leerling wordt de geïmporteerde oefenbank leeggemaakt; de leerkracht krijgt daarvoor geen waarschuwing en diens oefenbank blijft behouden.
- Leerlingengedeelte met opdrachten, antwoordcontrole en knop **Toon oplossing**.
- Leerkrachtbeheer is beveiligd met een lokale toegangscode; gegevens blijven in de browser.
- Oefeningen worden lokaal in de browser bewaard.

## Starten
Pak de ZIP uit en open `index.html` in een recente browser. Er is geen installatie nodig. Kies bij het starten **Leerling** om een oefeningenset te importeren of **Leerkracht** om met de leerkrachtcode naar het beheer te gaan.

## Leerkrachtcode
Democode: `2468`.

Wijzig bovenaan `app.js` de waarde van `TEACHER_PIN` om de lokale code aan te passen.

## Oefeningen aanpassen
1. Kies **Leerkracht** en meld je aan met de leerkrachtcode.
2. Kies bovenaan het onderdeel waarvoor je oefeningen wilt maken, bewerken, importeren of exporteren.
3. Vul de velden in bij **Nieuwe oefening**. Gebruik voor factuur- of creditnotaberekening de bijbehorende opbouwer en geef minstens één btw-tarief op. Het niveau en de antwoorden worden automatisch berekend; titels krijgen een uniek volgnummer met het huidige jaartal, zoals `F0001-JJJJ` of `CN0001-JJJJ`.
4. Bewaar de oefening; ze verschijnt in de leerlingenmodule nadat de leerling op **Nieuwe opgave** klikt. Factuur- en creditnota-oefeningen worden met de bijbehorende opbouwers samengesteld. Numeriek klavier heeft geen oefeneditor en wordt alleen met de module-schakelaar in- of uitgeschakeld.
5. Gebruik **Bewerken** of **Verwijderen** om de oefenbank aan te passen. Voor andere onderdelen kun je een opgave, antwoord en uitwerking handmatig invoeren.

## Back-up
Kies in het leerkrachtbeheer eerst een onderdeel en gebruik bovenaan **Exporteer oefeningenset**. Geef de JSON-back-up in de dialoog een naam; de suggestie bestaat uit de Nederlandse onderdeelnaam en de datum (`jaar-maand-dag`). Importeer een set om oefeningen van dat onderdeel toe te voegen. Een ID-botsing krijgt een nieuwe unieke ID, zodat bestaande oefeningen behouden blijven. Leerlingen kiezen **Leerling** en importeren daarna een oefeningenset; de bijbehorende module wordt voor die leerling ingeschakeld.

## Belangrijke beperkingen
- Dit is een eigen implementatie op basis van de publiek zichtbare structuur en functies van de voorbeeldwebsite. De originele broncode en de volledige oorspronkelijke oefeninhoud waren niet beschikbaar. Er worden geen oefeningen meegeleverd; importeer of maak eigen materiaal.
- De leerkrachtcode is uitsluitend een eenvoudige lokale toegangsdrempel. De code staat in de JavaScript-broncode en biedt geen echte beveiliging.
- Gegevens worden alleen in de browser bewaard. Er zijn geen leerlingaccounts, centrale databank of synchronisatie tussen toestellen.
- Loonberekeningen zijn vereenvoudigde didactische voorbeelden en geen actuele loonmotor.
- Controleer leerplandoelcodes en wettelijke gegevens aan de hand van de officiële cursus- en doelenbestanden voordat je materiaal aan leerlingen aanbiedt.

## Bestanden
- `index.html`: structuur en schermen
- `styles.css`: vormgeving
- `app.js`: oefenlogica, oefenbank en beheer
