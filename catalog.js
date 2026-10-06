const status = document.querySelector('#status');
const list = document.querySelector('#products');
const groupSelect = document.querySelector('#group');

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function priceText(item) {
  if (item.is_free) return 'Free';
  if (item.price) return `${item.price.amount} ${item.price.currency}`;
  if (item.virtual_prices?.length) {
    return item.virtual_prices.map(price => `${price.amount} ${price.name || price.sku}`).join(' / ');
  }
  return 'Price unavailable';
}

async function buy(item, button, message) {
  button.disabled = true;
  button.textContent = 'Opening...';
  message.textContent = '';
  try {
    let userId = localStorage.getItem('xsolla-test-buyer');
    if (!userId) {
      userId = `local-test-${crypto.randomUUID()}`;
      localStorage.setItem('xsolla-test-buyer', userId);
    }
    const response = await fetch('/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: item.sku, userId }),
      signal: AbortSignal.timeout(35000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to open checkout.');
    const url = new URL(result.checkoutUrl);
    if (url.origin !== 'https://sandbox-secure.xsolla.com' || url.pathname !== '/paystation4/') throw new Error('Invalid checkout URL.');
    window.location.assign(url.href);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = 'BUY';
  }
}

async function fetchItems(projectId, locale, type) {
  const items = [];
  let offset = 0;
  let hasMore;
  do {
    const url = new URL(`https://store.xsolla.com/api/v2/project/${projectId}/items/${type}`);
    url.search = new URLSearchParams({ locale, limit: '50', offset: String(offset) });
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
    const page = await response.json();
    if (!Array.isArray(page.items)) throw new Error('Unexpected catalog response.');
    items.push(...page.items);
    hasMore = page.has_more;
    if (hasMore && page.items.length === 0) throw new Error('Catalog pagination returned an empty page.');
    offset += page.items.length;
  } while (hasMore);
  return items;
}

function render(items) {
  const visible = items.filter(item => !groupSelect.value || item.groups?.some(group => group.external_id === groupSelect.value));
  list.replaceChildren(...visible.map(item => {
    const row = document.createElement('li');
    if (item.image_url) {
      const image = document.createElement('img');
      image.src = item.image_url;
      image.alt = item.name;
      image.addEventListener('error', () => image.remove(), { once: true });
      row.append(image);
    }
    const details = document.createElement('div');
    details.className = 'product-details';
    details.append(element('h2', item.name), element('small', item.sku));
    const price = element('p', priceText(item));
    if (item.price && Number(item.price.amount_without_discount) > Number(item.price.amount)) {
      price.append(' ', element('del', `${item.price.amount_without_discount} ${item.price.currency}`));
    }
    details.append(price);
    if (item.can_be_bought === false) details.append(element('p', 'Unavailable'));
    for (const [type, limit] of Object.entries(item.limits || {})) {
      if (limit) details.append(element('small', `${type === 'per_user' ? 'Per player' : 'Item limit'}: ${limit.available ?? limit.total} available${limit.total != null ? ` of ${limit.total}` : ''}`));
    }
    row.append(details);
    if (item.can_be_bought === true && !item.is_free && item.price && Number(item.price.amount) > 0) {
      const button = element('button', 'BUY');
      button.className = 'buy-button';
      button.type = 'button';
      button.setAttribute('aria-label', `BUY ${item.name}`);
      const message = element('p', '');
      message.setAttribute('role', 'alert');
      button.addEventListener('click', () => buy(item, button, message));
      details.append(message);
      row.append(button);
    }
    return row;
  }));
  status.textContent = visible.length ? `${visible.length} products` : 'No products available.';
}

try {
  const response = await fetch('/config.json');
  if (!response.ok) throw new Error('Unable to load shop configuration.');
  const { projectId, locale } = await response.json();
  document.documentElement.lang = locale;
  const catalogs = await Promise.all(['virtual_items', 'virtual_currency/package', 'bundle'].map(type => fetchItems(projectId, locale, type)));
  const items = [...new Map(catalogs.flat().map(item => [item.sku, item])).values()];
  const groups = new Map(items.flatMap(item => (item.groups || []).map(group => [group.external_id, group.name])));
  for (const [id, name] of groups) {
    const option = element('option', name);
    option.value = id;
    groupSelect.append(option);
  }
  document.querySelector('#filter').hidden = groups.size === 0;
  groupSelect.addEventListener('change', () => render(items));
  render(items);
} catch (error) {
  status.textContent = `Unable to load products. ${error.message}`;
}
