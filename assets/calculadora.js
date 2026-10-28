/* Ahorro Claro: local-only guided energy estimates. No persistence or tracking. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const form = byId('calc-form');
  if (!form) return;
  const euro = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const number = (n, digits = 2) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: digits }).format(n);
  const appliances = {
    fridge: { name: 'Frigorífico', methods: ['annual'], help: 'Busca el consumo en kWh/año en su etiqueta. No necesitas saber cuántas horas está enchufado.', example: [150, null] },
    washer: { name: 'Lavadora', methods: ['hundred', 'cycle', 'annual'], help: 'Busca los kWh de su etiqueta y fíjate si dice «100 ciclos», «ciclo» o «año». Un ciclo es una colada.', example: [50, 4] },
    dishwasher: { name: 'Lavavajillas', methods: ['hundred', 'cycle', 'annual'], help: 'Un ciclo es un programa completo. Usa el consumo de etiqueta o del programa que hayas medido.', example: [75, 5] },
    dryer: { name: 'Secadora', methods: ['hundred', 'cycle', 'annual'], help: 'Las etiquetas actuales usan kWh/100 ciclos; otras pueden indicar kWh/año. Copia la unidad que ves.', example: [120, 3] },
    light: { name: 'Bombilla', methods: ['power'], help: 'Busca los vatios (W) impresos en la bombilla. Introduce su potencia real, no la equivalencia con una antigua.', example: [9, 4] },
    other: { name: 'Otro aparato', methods: ['power', 'annual', 'hundred', 'cycle'], help: 'Elige la unidad de la etiqueta o de una medición. No uses potencia × horas si el aparato se enciende y apaga para regularse.', example: [50, 3] }
  };
  const methods = {
    annual: { title: 'Consumo de etiqueta: kWh al año', label: 'Consumo anual de la etiqueta (kWh/año)', hint: 'Copia solo el número junto a kWh/año. No hay que dividirlo entre días.', placeholder: 'Por ejemplo: 150', help: 'La etiqueta ya expresa el consumo de un año en condiciones de ensayo. Usaremos ese dato tal cual; tu uso real puede ser distinto.', max: 1000000, altLabel: 'Consumo anual de la otra opción (kWh/año)', altHelp: 'Copia la etiqueta de otro aparato comparable o un consumo anual medido. Esta comparación no incluye comprarlo. No reduzcas este número solo por bajar horas de uso.' },
    hundred: { title: 'Etiqueta: kWh por cada 100 ciclos', label: 'Consumo por 100 ciclos (kWh/100 ciclos)', hint: 'Copia el número completo: la calculadora ya lo dividirá entre 100.', placeholder: 'Por ejemplo: 50', help: 'Un ciclo es un programa completo. El número de la etiqueta cubre 100 ciclos, no uno.', max: 100000, freqLabel: '¿Cuántos ciclos haces a la semana?', freqHint: 'Puedes usar decimales: 1,5 equivale a tres ciclos cada dos semanas.', freqMax: 500, altLabel: '¿Cuántos ciclos harías a la semana?', altHelp: 'Mantendremos el mismo consumo por ciclo. Elige una frecuencia que puedas cumplir sin sobrecargar el aparato.' },
    cycle: { title: 'Consumo: kWh por un ciclo', label: 'Consumo de un programa (kWh/ciclo)', hint: 'Usa el consumo del programa, no los vatios de la placa.', placeholder: 'Por ejemplo: 0,8', help: 'Usa esta opción si conoces el consumo de un solo programa completo.', max: 1000, freqLabel: '¿Cuántos ciclos haces a la semana?', freqHint: 'Puedes usar decimales: 1,5 equivale a tres ciclos cada dos semanas.', freqMax: 500, altLabel: '¿Cuántos ciclos harías a la semana?', altHelp: 'Mantendremos el mismo consumo por ciclo. Un cambio de programa o de carga puede cambiar ese consumo.' },
    power: { title: 'Potencia y tiempo: vatios (W) + horas', label: 'Potencia real del aparato (W)', hint: 'Sirve si esa potencia representa su consumo medio mientras funciona. No es adecuada para estimar un frigorífico con los vatios de la placa.', placeholder: 'Por ejemplo: 9', help: 'Convertiremos los vatios en kW y los multiplicaremos por el tiempo de uso.', max: 1000000, freqLabel: '¿Cuántas horas al día, como media?', freqHint: 'De 0 a 24. Usaremos esta media los 365 días del año. Media hora se escribe 0,5.', freqMax: 24, altLabel: '¿Cuántas horas al día usarías la otra opción?', altHelp: 'Mantendremos los mismos vatios y cambiaremos solo las horas diarias de media. No supone cambiar de aparato.' }
  };
  let kind = null;
  let editingId = null;
  let priceIsExample = false;
  let applianceIsExample = false;
  let latestResult = null;
  let lastPrice = null;
  let nextId = 1;
  let saved = [];
  const fields = ['name', 'energy', 'frequency', 'price', 'alt'];

  function focusAndReveal(el) {
    el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  }
  function clearErrors() {
    fields.forEach(name => { byId('calc-' + name).removeAttribute('aria-invalid'); byId('calc-' + name + '-error').textContent = ''; });
    byId('calc-form-status').textContent = '';
  }
  function invalidateResult() {
    latestResult = null;
    byId('calc-result').hidden = true;
  }
  function markError(name, message) {
    byId('calc-' + name).setAttribute('aria-invalid', 'true');
    byId('calc-' + name + '-error').textContent = message;
    return null;
  }
  function readNumber(name, label, max, allowZero = true) {
    const raw = byId('calc-' + name).value.trim();
    if (!raw) return markError(name, 'Escribe ' + label + '.');
    if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(raw)) return markError(name, 'Usa un número sin unidades ni separadores de miles. Puedes escribir coma o punto decimal.');
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value) || value > max || (allowZero ? value < 0 : value <= 0)) return markError(name, 'Escribe un valor ' + (allowZero ? 'entre 0 y ' : 'mayor que 0 y no superior a ') + number(max) + '.');
    return value;
  }
  function updateExampleNotice() {
    const show = applianceIsExample || priceIsExample;
    byId('calc-example-notice').hidden = !show;
    byId('calc-example-message').textContent = applianceIsExample ? 'Estos datos se han rellenado para practicar. Aunque los cambies, seguiremos marcando el cálculo como ejemplo hasta que lo vacíes y uses tus propios datos.' : 'El precio de 0,20 €/kWh es solo un ejemplo. Sustitúyelo por tu tarifa para estimar tu coste.';
  }
  function updateAlternative() {
    const enabled = byId('calc-compare').checked;
    byId('calc-alt-fields').hidden = !enabled;
    byId('calc-alt').required = enabled;
  }
  function updateMethod(clearInputs = true) {
    const m = byId('calc-method').value;
    const config = methods[m];
    byId('calc-energy-label').textContent = config.label;
    byId('calc-energy-help').textContent = config.hint;
    byId('calc-energy').placeholder = config.placeholder;
    byId('calc-method-help').textContent = config.help;
    byId('calc-frequency-field').hidden = m === 'annual';
    byId('calc-frequency').required = m !== 'annual';
    byId('calc-frequency-label').textContent = config.freqLabel || 'Uso';
    byId('calc-frequency-help').textContent = config.freqHint || '';
    byId('calc-frequency').placeholder = m === 'power' ? 'Por ejemplo: 4' : 'Por ejemplo: 3';
    byId('calc-alt-label').textContent = config.altLabel;
    byId('calc-alt-help').textContent = config.altHelp;
    if (clearInputs) ['energy', 'frequency', 'alt'].forEach(name => { byId('calc-' + name).value = ''; });
    clearErrors();
    invalidateResult();
  }
  function resetForm() {
    form.reset();
    kind = null;
    editingId = null;
    priceIsExample = false;
    applianceIsExample = false;
    clearErrors();
    invalidateResult();
    byId('calc-data-panel').hidden = true;
    byId('calc-cancel-edit').hidden = true;
    document.querySelectorAll('[data-kind]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  }
  function chooseAppliance(newKind, moveFocus = true) {
    resetForm();
    kind = newKind;
    const appliance = appliances[kind];
    document.querySelectorAll('[data-kind]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.kind === kind)));
    byId('calc-appliance-help').textContent = appliance.help;
    byId('calc-name').placeholder = appliance.name;
    const select = byId('calc-method');
    select.replaceChildren(...appliance.methods.map(value => { const option = document.createElement('option'); option.value = value; option.textContent = methods[value].title; return option; }));
    byId('calc-data-title').textContent = 'Copia los datos: ' + appliance.name.toLowerCase();
    byId('calc-data-panel').hidden = false;
    byId('calc-reuse-price').hidden = !lastPrice;
    if (lastPrice) byId('calc-reuse-price').textContent = 'Reutilizar ' + number(lastPrice.value, 4) + ' €/kWh' + (lastPrice.example ? ' de ejemplo' : ' del cálculo anterior');
    updateMethod();
    updateAlternative();
    updateExampleNotice();
    if (moveFocus) focusAndReveal(byId('calc-data-title'));
  }
  function annualKwh(method, energy, frequency) {
    if (method === 'annual') return energy;
    if (method === 'hundred') return energy / 100 * frequency * 52;
    if (method === 'cycle') return energy * frequency * 52;
    return energy / 1000 * frequency * 365;
  }
  function explain(item) {
    const price = number(item.price, 4) + ' €/kWh';
    if (item.method === 'annual') return number(item.energy) + ' kWh al año × ' + price + ' = ' + euro(item.yearCost) + ' al año. Repartido entre 12 meses: ' + euro(item.yearCost / 12) + ' al mes.';
    if (item.method === 'hundred') return number(item.energy) + ' kWh por 100 ciclos equivalen a ' + number(item.energy / 100, 4) + ' kWh por ciclo. Con ' + number(item.frequency) + ' ciclos por semana durante 52 semanas y un precio de ' + price + ', el coste anual es ' + euro(item.yearCost) + '.';
    if (item.method === 'cycle') return number(item.energy, 4) + ' kWh por ciclo × ' + number(item.frequency) + ' ciclos por semana × 52 semanas × ' + price + ' = ' + euro(item.yearCost) + ' al año.';
    return number(item.energy) + ' W ÷ 1.000 × ' + number(item.frequency) + ' horas diarias de media × 365 días × ' + price + ' = ' + euro(item.yearCost) + ' al año.';
  }
  function appendParagraph(parent, text, strong = false) {
    const p = document.createElement('p');
    if (strong) { const s = document.createElement('strong'); s.textContent = text; p.append(s); } else p.textContent = text;
    parent.append(p);
  }
  function differenceText(difference, suffix = 'al año') {
    if (Math.abs(difference) < 0.005) return 'La diferencia redondeada es 0,00 € ' + suffix + '.';
    return 'La otra opción costaría ' + euro(Math.abs(difference)) + (difference > 0 ? ' menos ' : ' más ') + suffix + '.';
  }
  function showResult(item) {
    latestResult = item;
    byId('calc-result-name').textContent = item.name;
    byId('calc-result-month').textContent = euro(item.yearCost / 12);
    byId('calc-result-year').textContent = euro(item.yearCost);
    byId('calc-result-kwh').textContent = number(item.annual);
    byId('calc-result-explanation').textContent = explain(item);
    byId('calc-result-example').hidden = !item.example;
    const comparison = byId('calc-result-comparison');
    comparison.replaceChildren();
    comparison.hidden = item.alternative === null;
    if (item.alternative !== null) {
      appendParagraph(comparison, 'Otra opción: ' + euro(item.altYearCost / 12) + ' al mes · ' + euro(item.altYearCost) + ' al año', true);
      appendParagraph(comparison, differenceText(item.yearCost - item.altYearCost));
      appendParagraph(comparison, 'Es una comparación de energía, no un ahorro garantizado. No incluye comprar otro aparato.');
    }
    byId('calc-save').textContent = editingId === null ? 'Añadir al resumen +' : 'Guardar cambios en el resumen';
    byId('calc-result').hidden = false;
    focusAndReveal(byId('calc-result-title'));
  }
  function renderSummary() {
    byId('calc-count').textContent = saved.length + (saved.length === 1 ? ' aparato' : ' aparatos');
    byId('calc-empty').hidden = saved.length > 0;
    byId('calc-summary-content').hidden = saved.length === 0;
    if (!saved.length) { byId('calc-items').replaceChildren(); return; }
    const total = saved.reduce((sum, item) => sum + item.yearCost, 0);
    byId('calc-total-month').textContent = euro(total / 12);
    byId('calc-total-year').textContent = euro(total);
    byId('calc-summary-example').hidden = !saved.some(item => item.example);
    const alternative = saved.reduce((sum, item) => sum + (item.alternative === null ? item.yearCost : item.altYearCost), 0);
    const comparison = byId('calc-summary-comparison');
    comparison.replaceChildren();
    comparison.hidden = !saved.some(item => item.alternative !== null);
    if (!comparison.hidden) {
      appendParagraph(comparison, 'Con las opciones alternativas: ' + euro(alternative / 12) + '/mes', true);
      appendParagraph(comparison, differenceText(total - alternative));
      appendParagraph(comparison, 'Los aparatos sin comparación mantienen su consumo actual.');
    }
    const list = byId('calc-items');
    list.replaceChildren();
    const ranked = [...saved].sort((a, b) => b.yearCost - a.yearCost);
    ranked.forEach(item => {
      const card = document.createElement('article'); card.className = 'calc-item';
      if (item.example) { const tag = document.createElement('span'); tag.className = 'calc-tag'; tag.textContent = 'EJEMPLO'; card.append(tag); }
      const title = document.createElement('h3'); title.textContent = item.name; card.append(title);
      const cost = document.createElement('p'); cost.className = 'calc-item-cost'; cost.textContent = euro(item.yearCost / 12) + '/mes'; card.append(cost);
      const detail = document.createElement('p'); detail.className = 'calc-item-detail'; detail.textContent = number(item.annual) + ' kWh/año · ' + number(item.price, 4) + ' €/kWh'; card.append(detail);
      if (item.alternative !== null) { const p = document.createElement('p'); p.className = 'calc-item-detail'; p.textContent = differenceText(item.yearCost - item.altYearCost); card.append(p); }
      const actions = document.createElement('div'); actions.className = 'calc-item-actions';
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'calc-btn calc-btn-secondary calc-btn-small'; edit.textContent = 'Modificar'; edit.setAttribute('aria-label', 'Modificar ' + item.name); edit.addEventListener('click', () => editItem(item.id));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'calc-btn calc-btn-secondary calc-btn-small'; remove.textContent = 'Quitar'; remove.setAttribute('aria-label', 'Quitar ' + item.name); remove.addEventListener('click', () => { saved = saved.filter(row => row.id !== item.id); if (editingId === item.id) resetForm(); renderSummary(); byId('calc-announcement').textContent = item.name + ' se ha quitado del resumen.'; focusAndReveal(byId('calc-summary-title')); });
      actions.append(edit, remove); card.append(actions); list.append(card);
    });
    byId('calc-priority').textContent = total > 0 ? ranked[0].name + ' supone el ' + number(ranked[0].yearCost / total * 100, 0) + ' % de este total. Es un buen punto de partida para revisar tus opciones.' : 'Con la frecuencia de uso o precio que has indicado, este total es cero. No significa que todos los aparatos de tu vivienda consuman cero.';
  }
  function editItem(id) {
    const item = saved.find(row => row.id === id);
    if (!item) return;
    chooseAppliance(item.kind, false);
    editingId = item.id;
    byId('calc-method').value = item.method;
    updateMethod();
    byId('calc-name').value = item.name;
    byId('calc-energy').value = String(item.energy).replace('.', ',');
    byId('calc-frequency').value = item.frequency === null ? '' : String(item.frequency).replace('.', ',');
    byId('calc-price').value = String(item.price).replace('.', ',');
    byId('calc-compare').checked = item.alternative !== null;
    byId('calc-alt').value = item.alternative === null ? '' : String(item.alternative).replace('.', ',');
    priceIsExample = item.priceExample;
    applianceIsExample = item.applianceExample;
    byId('calc-cancel-edit').hidden = false;
    updateAlternative(); updateExampleNotice();
    byId('calc-data-title').textContent = 'Modificar: ' + item.name;
    focusAndReveal(byId('calc-data-title'));
  }

  document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => { byId('calc-announcement').textContent = ''; chooseAppliance(button.dataset.kind); }));
  byId('calc-method').addEventListener('change', () => updateMethod());
  form.addEventListener('input', event => {
    invalidateResult();
    const target = event.target;
    if (target.id === 'calc-price') { priceIsExample = false; updateExampleNotice(); }
    if (target.id.startsWith('calc-')) {
      const name = target.id.slice(5);
      if (fields.includes(name)) { target.removeAttribute('aria-invalid'); byId('calc-' + name + '-error').textContent = ''; }
    }
  });
  byId('calc-compare').addEventListener('change', () => { updateAlternative(); invalidateResult(); });
  byId('calc-example-price').addEventListener('click', () => { byId('calc-price').value = '0,20'; priceIsExample = true; byId('calc-price').removeAttribute('aria-invalid'); byId('calc-price-error').textContent = ''; invalidateResult(); updateExampleNotice(); });
  byId('calc-reuse-price').addEventListener('click', () => { if (!lastPrice) return; byId('calc-price').value = String(lastPrice.value).replace('.', ','); priceIsExample = lastPrice.example; byId('calc-price').removeAttribute('aria-invalid'); byId('calc-price-error').textContent = ''; invalidateResult(); updateExampleNotice(); });
  byId('calc-example').addEventListener('click', () => {
    const config = appliances[kind];
    const m = byId('calc-method').value;
    let energy = config.example[0];
    let frequency = config.example[1];
    if (m === 'annual') { energy = kind === 'fridge' ? 150 : 180; frequency = null; }
    if (m === 'cycle') { energy = kind === 'dryer' ? 1.2 : 0.8; frequency = 3; }
    if (m === 'hundred' && kind === 'other') { energy = 80; frequency = 3; }
    byId('calc-name').value = config.name;
    byId('calc-energy').value = String(energy).replace('.', ',');
    byId('calc-frequency').value = frequency === null ? '' : String(frequency).replace('.', ',');
    byId('calc-price').value = '0,20';
    byId('calc-compare').checked = false;
    byId('calc-alt').value = '';
    applianceIsExample = true; priceIsExample = true;
    clearErrors(); updateAlternative(); updateExampleNotice(); invalidateResult();
  });
  byId('calc-clear-example').addEventListener('click', () => {
    ['name', 'energy', 'frequency', 'price', 'alt'].forEach(name => { byId('calc-' + name).value = ''; });
    byId('calc-compare').checked = false;
    applianceIsExample = false; priceIsExample = false;
    clearErrors(); invalidateResult(); updateAlternative(); updateExampleNotice(); byId('calc-energy').focus();
  });
  byId('calc-cancel-edit').addEventListener('click', () => { resetForm(); focusAndReveal(byId('calc-summary-title')); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    clearErrors(); invalidateResult();
    if (!kind) return;
    const method = byId('calc-method').value;
    const config = methods[method];
    const energy = readNumber('energy', method === 'power' ? 'los vatios del aparato' : 'el consumo de la etiqueta o medición', config.max, false);
    const frequency = method === 'annual' ? null : readNumber('frequency', method === 'power' ? 'las horas de uso diario' : 'los ciclos por semana', config.freqMax);
    const price = readNumber('price', 'tu precio de energía en €/kWh, o elige el ejemplo', 10);
    const compare = byId('calc-compare').checked;
    const alternative = compare ? readNumber('alt', 'el dato de la otra opción', method === 'annual' ? config.max : config.freqMax, method !== 'annual') : null;
    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    if (firstInvalid) { byId('calc-form-status').textContent = 'Falta algún dato o hay un número que revisar. Aún no hemos calculado ningún resultado.'; firstInvalid.focus(); return; }
    const annual = annualKwh(method, energy, frequency);
    const altAnnual = !compare ? null : method === 'annual' ? alternative : annualKwh(method, energy, alternative);
    showResult({ id: editingId, kind, method, name: byId('calc-name').value.trim() || appliances[kind].name, energy, frequency, price, alternative, annual, yearCost: annual * price, altAnnual, altYearCost: compare ? altAnnual * price : null, priceExample: priceIsExample, applianceExample: applianceIsExample, example: priceIsExample || applianceIsExample });
  });
  byId('calc-edit-result').addEventListener('click', () => focusAndReveal(byId('calc-data-title')));
  byId('calc-save').addEventListener('click', () => {
    if (!latestResult) return;
    const item = { ...latestResult };
    const updated = editingId !== null;
    if (updated) saved = saved.map(row => row.id === editingId ? item : row);
    else { item.id = nextId++; saved.push(item); }
    lastPrice = { value: item.price, example: item.priceExample };
    resetForm(); renderSummary();
    byId('calc-announcement').textContent = item.name + (updated ? ': cambios guardados.' : ' añadido al resumen. Puedes elegir otro aparato en el paso 1.');
    focusAndReveal(byId('calc-summary-title'));
  });
  byId('calc-add-next').addEventListener('click', () => { resetForm(); focusAndReveal(byId('calc-choose-title')); });
  byId('calc-download').addEventListener('click', () => {
    if (!saved.length) return;
    const quote = value => { let text = String(value); if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; };
    const decimal = n => n === null ? '' : n.toFixed(4).replace('.', ',');
    const rows = [['Aparato', 'Datos de ejemplo', 'Método', 'Dato consumo', 'Uso semanal o diario', 'Precio EUR/kWh', 'kWh/año', 'EUR/mes', 'EUR/año', 'Dato alternativo', 'EUR/año alternativa', 'Diferencia EUR/año'], ...saved.map(item => [item.name, item.example ? 'Sí' : 'No', methods[item.method].title, decimal(item.energy), decimal(item.frequency), decimal(item.price), decimal(item.annual), decimal(item.yearCost / 12), decimal(item.yearCost), decimal(item.alternative), decimal(item.altYearCost), item.alternative === null ? '' : decimal(item.yearCost - item.altYearCost)])];
    const total = saved.reduce((sum, row) => sum + row.yearCost, 0);
    rows.push(['TOTAL APARATOS AÑADIDOS', saved.some(row => row.example) ? 'Incluye ejemplos' : '', '', '', '', '', decimal(saved.reduce((sum, row) => sum + row.annual, 0)), decimal(total / 12), decimal(total)]);
    rows.push(['Supuestos', '52 semanas/año para ciclos; 365 días/año para horas; media mensual = anual/12. Cada fila conserva su precio.']);
    rows.push(['Límites', 'Solo energía de los aparatos añadidos; no se añaden potencia, alquiler, impuestos ni otros cargos. No es ahorro garantizado.']);
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'ahorro-claro-mi-resumen.csv'; document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    byId('calc-announcement').textContent = 'Resumen descargado. Incluye los supuestos y los ejemplos identificados.';
  });
})();
