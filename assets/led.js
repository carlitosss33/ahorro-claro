(() => {
  const $ = id => document.getElementById(id);
  const ids = ['old-w','new-w','hours','price','bulb-cost'];
  let example = false;
  const money = n => n.toLocaleString('es-ES',{style:'currency',currency:'EUR'});
  const fmt = n => n.toLocaleString('es-ES',{maximumFractionDigits:2});
  function parse(id) {
    const text = $(id).value.trim();
    return text !== '' && /^\d+(?:[.,]\d+)?$/.test(text) ? Number(text.replace(',','.')) : NaN;
  }
  $('led-example').addEventListener('click', () => {
    ids.forEach((id,i) => { $(id).value = ['60','9','5','0,20','4'][i]; $(id).removeAttribute('aria-invalid'); });
    example = true;
    $('led-example-note').hidden = false;
    $('led-error').textContent = '';
    $('led-result').hidden = true;
    $('led-update').textContent = 'Ejemplo cargado. Pulsa «Calcular» para ver su resultado.';
  });
  ids.forEach(id => $(id).addEventListener('input', () => {
    $('led-result').hidden = true;
    $('led-update').textContent = 'Pulsa «Calcular» para actualizar el resultado.';
    if(example) $('led-example-note').textContent = 'Partiste de un ejemplo y has editado sus valores. Comprueba todos los campos antes de usarlo como estimación de tu casa.';
    $(id).removeAttribute('aria-invalid');
  }));
  $('led-form').addEventListener('submit', e => {
    e.preventDefault();
    const vals = ids.map(parse);
    const limits = [10000,10000,24,1000,100000];
    const bad = ids.findIndex((id,i) => (i===4 && $(id).value.trim()==='') ? false : !Number.isFinite(vals[i]) || vals[i]<0 || vals[i]>limits[i]);
    $('led-result').hidden = true;
    if(bad !== -1) {
      $('led-error').textContent = bad===2 ? 'Introduce las horas entre 0 y 24.' : 'Revisa el campo señalado. Usa un número positivo o cero, con coma o punto decimal y sin símbolos.';
      $(ids[bad]).setAttribute('aria-invalid','true');
      $(ids[bad]).focus();
      return;
    }
    $('led-error').textContent = '';
    const [oldW,newW,hours,price,cost] = vals;
    const kwh = (oldW-newW)/1000*hours*365;
    const annual = kwh*price;
    $('led-saving').textContent = money(annual);
    $('led-result-label').textContent = annual>0 ? 'Ahorro eléctrico estimado al año · una bombilla' : 'Diferencia de coste estimada al año · una bombilla';
    $('led-payback').textContent = annual>0 ? (Number.isFinite(cost) ? (cost===0 ? 'No hay desembolso que recuperar.' : 'Recuperación simple del precio de la LED: '+fmt(cost/annual*12)+' meses, si se mantienen estos datos.') : 'Añade el precio de compra si quieres calcular su recuperación.') : annual===0 ? 'Con estos datos no hay diferencia de coste eléctrico.' : 'La nueva bombilla gastaría más con estos datos. No hay recuperación por ahorro eléctrico.';
    $('led-calculation').textContent = `(${fmt(oldW)} − ${fmt(newW)}) W ÷ 1.000 × ${fmt(hours)} horas × 365 días × ${fmt(price)} €/kWh. ${example ? 'Cálculo basado en un ejemplo, con posibles valores editados.' : 'Cálculo con los valores introducidos.'} No incluye costes fijos ni impuestos.`;
    $('led-update').textContent = '';
    $('led-result').hidden = false;
    $('led-result').focus();
  });
})();
