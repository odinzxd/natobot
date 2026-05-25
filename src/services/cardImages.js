const imageAliases = {
  'Alexander den store': 'Alexander the Great',
  'Arthur Wellesley, Duke of Wellington': 'Arthur Wellesley, 1st Duke of Wellington',
  'Ayatollah Khomeini': 'Ruhollah Khomeini',
  Beyonce: 'Beyoncé',
  'BeyoncÃ©': 'Beyoncé',
  'BjÃ¸rnar Moxnes': 'Bjørnar Moxnes',
  'BÃ¸rge Brende': 'Børge Brende',
  'Dwayne "The Rock" Johnson': 'Dwayne Johnson',
  'Erling Braut Haaland': 'Erling Haaland',
  'Georgij Zjukov': 'Georgy Zhukov',
  'Harald HardrÃ¥de': 'Harald Hardrada',
  'Harald Hardråde': 'Harald Hardrada',
  'Ine Eriksen SÃ¸reide': 'Ine Eriksen Søreide',
  'Jeanne dâ€™Arc': 'Joan of Arc',
  'Jeanne d’Arc': 'Joan of Arc',
  'Jonas Gahr StÃ¸re': 'Jonas Gahr Støre',
  'Kylian MbappÃ©': 'Kylian Mbappé',
  'Kylian Mbappé': 'Kylian Mbappé',
  'Recep Tayyip ErdoÄŸan': 'Recep Tayyip Erdoğan',
  'Recep Tayyip Erdoğan': 'Recep Tayyip Erdoğan',
  'Richard LÃ¸vehjerte': 'Richard I of England',
  'Richard Løvehjerte': 'Richard I of England',
  'SimÃ³n BolÃ­var': 'Simón Bolívar',
  'Simón Bolívar': 'Simón Bolívar',
  'Themistokles': 'Themistocles',
  'Volodymyr Zelenskyj': 'Volodymyr Zelenskyy',
  'Zlatan IbrahimoviÄ‡': 'Zlatan Ibrahimović',
  'Zlatan Ibrahimović': 'Zlatan Ibrahimović'
};

const imageCache = new Map();

function normalizeTitle(name) {
  return imageAliases[name] || name;
}

function fallbackImage(name) {
  const params = new URLSearchParams({
    name,
    background: '1f2937',
    color: 'ffffff',
    bold: 'true',
    size: '512'
  });
  return `https://ui-avatars.com/api/?${params.toString()}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(2500),
    headers: {
      'User-Agent': 'Natobot/1.0 Discord card bot image resolver'
    }
  });
  if (!response.ok) return null;
  return response.json();
}

async function resolveFromSummary(title, language) {
  const encodedTitle = encodeURIComponent(title.replaceAll(' ', '_'));
  const data = await fetchJson(`https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`);
  return data?.thumbnail?.source || data?.originalimage?.source || null;
}

async function resolveFromSearch(title, language) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: title,
    gsrlimit: '1',
    prop: 'pageimages',
    piprop: 'thumbnail|original',
    pithumbsize: '700',
    format: 'json'
  });
  const data = await fetchJson(`https://${language}.wikipedia.org/w/api.php?${params.toString()}`);
  const page = data?.query?.pages ? Object.values(data.query.pages)[0] : null;
  return page?.thumbnail?.source || page?.original?.source || null;
}

export async function resolveCardImage(name) {
  if (imageCache.has(name)) return imageCache.get(name);

  const title = normalizeTitle(name);
  const attempts = [
    () => resolveFromSummary(title, 'en'),
    () => resolveFromSummary(title, 'no'),
    () => resolveFromSearch(title, 'en'),
    () => resolveFromSearch(title, 'no')
  ];

  for (const attempt of attempts) {
    try {
      const imageUrl = await attempt();
      if (imageUrl) {
        imageCache.set(name, imageUrl);
        return imageUrl;
      }
    } catch (error) {
      console.warn(`[images] Could not resolve image for ${name}:`, error.message);
    }
  }

  const fallback = fallbackImage(name);
  imageCache.set(name, fallback);
  return fallback;
}
