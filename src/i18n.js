// -----------------------------------------------------------------------------
// Texts produced by the container, in the four languages of the Gladys
// interface. German says "du", Spanish "usted".
// -----------------------------------------------------------------------------

/** Feature names (frozen in Gladys when the device is created). */
export const NAMES = {
  en: {
    balance: 'Soil water balance',
    water: 'Water to bring',
    duration: 'Advised watering time',
    et0Yesterday: "Yesterday's ET0",
    et0Today: "Today's ET0",
    rainToday: 'Rain forecast today',
  },
  fr: {
    balance: 'Bilan hydrique du sol',
    water: 'Eau à apporter',
    duration: "Durée d'arrosage conseillée",
    et0Yesterday: "ET0 d'hier",
    et0Today: 'ET0 du jour',
    rainToday: "Pluie prévue aujourd'hui",
  },
  de: {
    balance: 'Wasserbilanz des Bodens',
    water: 'Benötigte Wassermenge',
    duration: 'Empfohlene Bewässerungsdauer',
    et0Yesterday: 'ET0 von gestern',
    et0Today: 'ET0 von heute',
    rainToday: 'Regenvorhersage heute',
  },
  es: {
    balance: 'Balance hídrico del suelo',
    water: 'Agua a aportar',
    duration: 'Duración de riego aconsejada',
    et0Yesterday: 'ET0 de ayer',
    et0Today: 'ET0 de hoy',
    rainToday: 'Lluvia prevista hoy',
  },
};

/** Short texts: widget, messages. */
export const TEXT = {
  en: {
    noWater: 'no watering',
    rain: 'rain expected',
    weatherLine: 'Today: ET0 {et0} mm · rain {rain} mm',
    wateredButton: '{name}: watered',
    wateredDone: 'Zone marked as watered',
    waiting: 'Waiting for the first forecast',
    noZone: 'No zone configured: give a zone a name in the configuration.',
  },
  fr: {
    noWater: 'pas d’arrosage',
    rain: 'pluie prévue',
    weatherLine: "Aujourd'hui : ET0 {et0} mm · pluie {rain} mm",
    wateredButton: '{name} : arrosé',
    wateredDone: 'Zone notée comme arrosée',
    waiting: 'En attente des premières prévisions',
    noZone: 'Aucune zone configurée : donnez un nom à une zone dans la configuration.',
  },
  de: {
    noWater: 'keine Bewässerung',
    rain: 'Regen erwartet',
    weatherLine: 'Heute: ET0 {et0} mm · Regen {rain} mm',
    wateredButton: '{name}: gegossen',
    wateredDone: 'Zone als bewässert markiert',
    waiting: 'Warte auf die erste Vorhersage',
    noZone: 'Keine Zone konfiguriert: gib einer Zone in der Konfiguration einen Namen.',
  },
  es: {
    noWater: 'sin riego',
    rain: 'lluvia prevista',
    weatherLine: 'Hoy: ET0 {et0} mm · lluvia {rain} mm',
    wateredButton: '{name}: regada',
    wateredDone: 'Zona marcada como regada',
    waiting: 'Esperando la primera previsión',
    noZone: 'Ninguna zona configurada: dé un nombre a una zona en la configuración.',
  },
};

/** Messages of the connection status (an object with every language). */
export const STATUS = {
  noLocation: {
    en: 'No house location in Gladys: set the coordinates of your house (Settings → Houses).',
    fr: 'Aucune position de maison dans Gladys : renseignez ses coordonnées (Paramètres → Maisons).',
    de: 'Kein Hausstandort in Gladys: trage die Koordinaten deines Hauses ein (Einstellungen → Häuser).',
    es: 'Ninguna ubicación de casa en Gladys: indique sus coordenadas (Ajustes → Casas).',
  },
  invalid: {
    en: 'Unreadable number in zones {slots}: use digits only, e.g. 0.8 or 12,5.',
    fr: 'Nombre illisible dans les zones {slots} : uniquement des chiffres, par exemple 0,8 ou 12,5.',
    de: 'Unlesbare Zahl in den Zonen {slots}: nur Ziffern, zum Beispiel 0,8 oder 12,5.',
    es: 'Número ilegible en las zonas {slots}: solo cifras, por ejemplo 0,8 o 12,5.',
  },
  apiError: {
    en: 'Open-Meteo cannot be reached: the advice uses the last forecast received.',
    fr: 'Open-Meteo est injoignable : le conseil s’appuie sur les dernières prévisions reçues.',
    de: 'Open-Meteo ist nicht erreichbar: die Empfehlung nutzt die letzte erhaltene Vorhersage.',
    es: 'Open-Meteo no está disponible: el consejo usa la última previsión recibida.',
  },
};

export function pick(table, language) {
  return table[language] ?? table.en;
}

/** One text in every language, `{name}` placeholders filled. */
export function allLanguages(table, key, values = {}) {
  return Object.fromEntries(
    Object.entries(table).map(([lang, texts]) => [
      lang,
      Object.entries(values).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, value),
        texts[key],
      ),
    ]),
  );
}

/** "12.5" or "12,5" by language. */
export function formatNumber(value, language) {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
}
