# Arrosage conseillé

La quantité d'eau dont chaque zone du jardin a besoin aujourd'hui, d'après le bilan hydrique du sol :
l'évapotranspiration de référence (ET0, FAO-56) moins la pluie, à la position de votre maison. Les données viennent
d'[Open-Meteo](https://open-meteo.com/), gratuit et sans compte. L'intégration conseille : elle ne commande aucune
vanne, ce sont vos scènes qui lancent le programmateur d'arrosage.

## Ce que vous obtenez

Un appareil par zone, avec des capteurs en lecture seule :

- **Eau à apporter** (mm) : le déficit du bilan, 0 quand le sol en a assez ou quand de la pluie est prévue ;
- **Durée d'arrosage conseillée** (minutes) : l'eau à apporter divisée par le débit d'arrosage de la zone (seulement
  si un débit en mm/h, ou un débit en L/min et une surface, sont configurés) ;
- **Bilan hydrique du sol** (mm) : négatif = eau manquante, positif = eau gardée en réserve ;
- **ET0 d'hier** et **ET0 du jour** (mm/jour), et la **Pluie prévue aujourd'hui** (mm/jour).

## Comment le conseil est calculé

Chaque jour à l'heure du calcul, la veille est ajoutée au bilan de chaque zone :

`bilan = min(plafond de réserve, bilan de la veille + pluie − Kc × ET0)`

- L'**ET0** est l'évapotranspiration de référence d'un gazon bien arrosé (FAO-56 Penman-Monteith), calculée par
  Open-Meteo d'après la température, le vent, l'humidité et l'ensoleillement.
- **Kc**, le coefficient cultural, l'adapte à la plantation : gazon 0,85, potager 1, massifs fleuris 0,75, haies et
  arbustes 0,5, ou la valeur que vous saisissez.
- Le **plafond de réserve** est l'excédent d'eau que le sol garde après une forte pluie ; il est consommé avant tout
  conseil d'arrosage.
- **Eau à apporter** = −bilan quand le bilan est négatif. Quand la pluie prévue dans la journée atteint le seuil, le
  conseil est 0 (le déficit reste dans le bilan, et la pluie sera comptée le lendemain).
- **Durée** = eau à apporter ÷ débit × 60. Le débit en mm/h est saisi, ou calculé d'après le débit en L/min et la
  surface (1 L sur 1 m² = 1 mm).

Le bilan est conservé dans `/data` au redémarrage. Après un arrêt, les jours manquants sont comptés au calcul suivant
(jusqu'à 7 jours en arrière). Notez un arrosage avec l'action de scène « Zone arrosée » ou le bouton du widget : sans
quantité, le bilan revient à 0 (ration complète).

## Configuration

Renseignez les coordonnées de votre maison dans Gladys (Paramètres → Maisons) : l'intégration les lit.

- **Langue des noms et des textes** : les noms des fonctionnalités (figés à l'ajout de l'appareil) et les textes du
  widget.
- **Pluie qui annule l'arrosage** : en mm, décimales acceptées (2,5) ; 0 la désactive.
- **Heure du calcul quotidien** (0-23, 5 par défaut) : choisissez-la avant l'heure d'arrosage.
- **Zones 1 à 4** : une zone existe dès qu'elle a un nom. Puis son type de plantation (ou un Kc), son débit d'arrosage
  en mm/h, ou son débit en L/min et sa surface arrosée en m², et son plafond de réserve en mm (25 par défaut, 0 pour
  aucun report, par exemple des pots).

Ordres de grandeur : arroseur oscillant 5 à 10 mm/h, tuyère escamotable 25 à 40 mm/h, goutte-à-goutte : débit des
goutteurs × nombre ÷ surface.

## Actions

**Voir le conseil maintenant** lit Open-Meteo si besoin et affiche l'eau et la durée de chaque zone.

## Scènes

- Déclencheur **Arrosage conseillé** : une fois par jour, à l'heure du calcul, pour chaque zone qui a besoin d'eau
  (filtre sur une zone ou non). Ses variables : zone, eau à apporter (mm), durée conseillée (minutes, 0 si inconnue).
  Scène type : « Arrosage conseillé » sur la pelouse → ouvrir la vanne du programmateur (OpenSprinkler, Rain Bird, une
  prise connectée…) → attendre la durée conseillée → la fermer → « Zone arrosée ».
- Action **Zone arrosée** : compte un arrosage dans le bilan, la quantité donnée en mm ou une ration complète si elle
  est vide. Sans zone, toutes les zones.
- Les déclencheurs habituels de Gladys sur les valeurs de l'appareil marchent aussi, par exemple « Durée d'arrosage
  conseillée supérieure à 0 » avec une condition horaire.

## Tableau de bord

Le widget **Arrosage conseillé** affiche l'ET0 et la pluie du jour, l'eau et la durée de chaque zone, et un bouton
« arrosé » par zone. Ses réglages masquent la ligne météo ou les boutons. Les capteurs des appareils peuvent aussi être
ajoutés au tableau de bord, avec leur historique.

## Limites et dépannage

- Une estimation, pas une mesure : le type de sol, la pente, l'ombre ou le vent ne sont pas connus. Ajustez le Kc ou
  le plafond de réserve après quelques semaines si la pelouse jaunit (Kc plus haut) ou reste détrempée (Kc plus bas).
- La pluie comptée est celle modélisée par Open-Meteo à vos coordonnées, pas celle de votre pluviomètre. Un orage
  local peut être manqué.
- Open-Meteo est gratuit pour un usage non commercial (moins de 10 000 requêtes par jour) : l'intégration le lit toutes
  les 3 heures. Données sous licence CC BY 4.0, par Open-Meteo.com.
- « Aucune position de maison » : renseignez les coordonnées de votre maison. « Open-Meteo est injoignable » : le
  conseil garde les dernières prévisions et l'intégration réessaie toutes les 15 minutes.
- Détails dans les journaux : réglez `LOG_LEVEL=debug`.
