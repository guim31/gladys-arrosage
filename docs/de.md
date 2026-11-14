# Arrosage conseillé — Bewässerungsempfehlung

Wie viel Wasser jede Zone deines Gartens heute braucht, aus der Wasserbilanz des Bodens: die Referenz-Verdunstung
(ET0, FAO-56) minus der Regen, am Standort deines Hauses. Die Daten kommen von [Open-Meteo](https://open-meteo.com/),
kostenlos und ohne Konto. Die Integration empfiehlt nur: sie steuert kein Ventil, deine Szenen starten den
Bewässerungscomputer.

## Was du bekommst

Ein Gerät pro Zone, mit schreibgeschützten Sensoren:

- **Benötigte Wassermenge** (mm): das Defizit der Bilanz, 0 wenn der Boden genug hat oder Regen vorhergesagt ist;
- **Empfohlene Bewässerungsdauer** (Minuten): die Wassermenge geteilt durch die Beregnungsrate der Zone (nur wenn eine
  Rate oder ein Durchfluss mit Fläche konfiguriert ist);
- **Wasserbilanz des Bodens** (mm): negativ = fehlendes Wasser, positiv = Wasser in Reserve;
- **ET0 von gestern** und **ET0 von heute** (mm/Tag) sowie die **Regenvorhersage heute** (mm/Tag).

## Wie die Empfehlung berechnet wird

Jeden Tag zur Berechnungsstunde wird der Vortag zur Bilanz jeder Zone addiert:

`Bilanz = min(Obergrenze der Reserve, Bilanz des Vortags + Regen − Kc × ET0)`

- **ET0** ist die Referenz-Verdunstung eines gut bewässerten Rasens (FAO-56 Penman-Monteith), von Open-Meteo aus
  Temperatur, Wind, Feuchte und Sonnenschein berechnet.
- **Kc**, der Pflanzenkoeffizient, passt sie an die Bepflanzung an: Rasen 0,85, Gemüsegarten 1, Blumenbeete 0,75,
  Hecken und Sträucher 0,5, oder der Wert, den du eingibst.
- Die **Obergrenze der Reserve** ist das überschüssige Wasser, das der Boden nach starkem Regen speichert; es wird
  verbraucht, bevor eine Bewässerung empfohlen wird.
- **Benötigte Wassermenge** = −Bilanz, wenn die Bilanz negativ ist. Erreicht der vorhergesagte Regen des Tages die
  Schwelle, ist die Empfehlung 0 (das Defizit bleibt in der Bilanz, der Regen wird morgen angerechnet).
- **Dauer** = Wassermenge ÷ Rate × 60. Die Rate in mm/h wird eingegeben oder aus Durchfluss und Fläche berechnet (1 L
  auf 1 m² = 1 mm).

Die Bilanz bleibt in `/data` über Neustarts erhalten. Nach einem Stopp werden die fehlenden Tage bei der nächsten
Berechnung angerechnet (bis zu 7 Tage zurück). Markiere eine Bewässerung mit der Szenenaktion „Zone bewässert“ oder
der Taste des Widgets: ohne Menge geht die Bilanz auf 0 zurück (volle Gabe).

## Konfiguration

Trage die Koordinaten deines Hauses in Gladys ein (Einstellungen → Häuser): die Integration liest sie.

- **Sprache der Namen und Texte**: die Namen der Funktionen (beim Hinzufügen des Geräts festgelegt) und die Texte des
  Widgets.
- **Regen, der das Gießen absagt**: in mm, Dezimalzahlen erlaubt (2,5); 0 deaktiviert ihn.
- **Uhrzeit der täglichen Berechnung** (0-23, standardmäßig 5): wähle sie vor deiner Gießzeit.
- **Zonen 1 bis 4**: eine Zone existiert, sobald sie einen Namen hat. Dann ihre Art der Bepflanzung (oder ein Kc),
  ihre Beregnungsrate in mm/h oder ihr Durchfluss in L/min mit der bewässerten Fläche in m², und ihre Obergrenze der
  Reserve in mm (standardmäßig 25, 0 für keinen Übertrag, z. B. Töpfe).

Richtwerte: Schwenkregner 5 bis 10 mm/h, Versenkdüse 25 bis 40 mm/h, Tropfschlauch: Durchfluss der Tropfer × Anzahl ÷
Fläche.

## Aktionen

**Empfehlung jetzt anzeigen** liest Open-Meteo bei Bedarf und zeigt Wasser und Dauer jeder Zone.

## Szenen

- Auslöser **Bewässerung empfohlen**: einmal am Tag zur Berechnungsstunde für jede Zone, die Wasser braucht (Filter auf
  eine Zone oder nicht). Seine Variablen: Zone, benötigte Wassermenge (mm), empfohlene Dauer (Minuten, 0 wenn
  unbekannt). Typische Szene: „Bewässerung empfohlen“ für den Rasen → Ventil des Bewässerungscomputers öffnen
  (OpenSprinkler, Rain Bird, eine smarte Steckdose…) → die empfohlene Dauer warten → schließen → „Zone bewässert“.
- Aktion **Zone bewässert**: rechnet eine Bewässerung in die Bilanz ein, die angegebene Menge in mm oder eine volle
  Gabe, wenn leer. Ohne Zone alle Zonen.
- Die üblichen Gladys-Auslöser auf die Gerätewerte funktionieren auch, z. B. „Empfohlene Bewässerungsdauer über 0“
  mit einer Zeitbedingung.

## Dashboard

Das Widget **Bewässerungsempfehlung** zeigt ET0 und Regen von heute, Wasser und Dauer jeder Zone und eine Taste
„gegossen“ pro Zone. Seine Einstellungen blenden die Wetterzeile oder die Tasten aus. Die Sensoren der Geräte können
auch mit ihrem Verlauf zum Dashboard hinzugefügt werden.

## Grenzen und Fehlerbehebung

- Eine Schätzung, keine Messung: Bodenart, Hang, Schatten oder Wind sind nicht bekannt. Passe Kc oder Obergrenze der
  Reserve nach einigen Wochen an, wenn der Rasen gelb wird (Kc höher) oder durchnässt bleibt (Kc niedriger).
- Der angerechnete Regen ist der von Open-Meteo an deinen Koordinaten modellierte, nicht der deines Regenmessers. Ein
  lokales Gewitter kann fehlen.
- Open-Meteo ist für nicht kommerzielle Nutzung kostenlos (weniger als 10.000 Anfragen pro Tag): die Integration liest
  es alle 3 Stunden. Daten unter CC BY 4.0, von Open-Meteo.com.
- „Kein Hausstandort“: trage die Koordinaten deines Hauses ein. „Open-Meteo ist nicht erreichbar“: die Empfehlung
  behält die letzte Vorhersage und die Integration versucht es alle 15 Minuten erneut.
- Details in den Logs: setze `LOG_LEVEL=debug`.
