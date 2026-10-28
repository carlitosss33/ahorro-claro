(() => {
 const $=id=>document.getElementById(id);
 const fields=['old','new','price','investment'];
 const fmt=x=>x.toLocaleString('es-ES',{maximumFractionDigits:1});
 const eur=x=>x.toLocaleString('es-ES',{style:'currency',currency:'EUR'});
 function update(){
  const invalid=fields.find(id=>$(id).value.trim()==='' || !$(id).validity.valid || !Number.isFinite(Number($(id).value)));
  fields.forEach(id=>$(id).removeAttribute('aria-invalid'));
  $('comparison-results').hidden=Boolean(invalid);
  $('error').textContent=invalid?'Completa los cuatro campos con números positivos o cero. No se muestra un resultado con datos incompletos.':'';
  if(invalid){$(invalid).setAttribute('aria-invalid','true');return;}
  const [old,next,price,investment]=fields.map(id=>Number($(id).value));
  const difference=(old-next)*price;
  $('energy').textContent=fmt(old-next)+' kWh/año';
  $('saving').textContent=eur(difference)+' / año';
  $('current').textContent=eur(old*price);$('future').textContent=eur(next*price);
  $('payback').textContent=difference>0?(investment>0?'Plazo simple de recuperación: '+fmt(investment/difference)+' años.':'Sin desembolso que recuperar. La diferencia eléctrica es positiva.'):difference===0?'Con estos datos no hay ahorro eléctrico para recuperar la compra.':'La otra opción consume más con estos datos: no hay recuperación mediante ahorro eléctrico.';
  $('five').textContent='Balance simple a cinco años, descontando el desembolso: '+eur(difference*5-investment)+'. No es una previsión del precio futuro de la luz.';
 }
 fields.forEach(id=>$(id).addEventListener('input',update)); update();
})();
