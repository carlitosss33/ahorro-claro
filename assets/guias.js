(() => {
 const $=id=>document.getElementById(id);
 const kind=document.body.dataset.guide;
 const fields=[...document.querySelectorAll('.prose-main input')];
 const money=n=>n.toLocaleString('es-ES',{style:'currency',currency:'EUR'});
 const count=(n,d=1)=>n.toLocaleString('es-ES',{maximumFractionDigits:d});
 const resultIds=kind==='fridge'?['annual','monthly']:kind==='dryer'?['per','month']:['litres','kwh','cost'];
 function update(){
  const bad=fields.find(e=>e.value.trim()==='' || !e.validity.valid || !Number.isFinite(Number(e.value)) || Number(e.value)<0);
  const temperatureBad=kind==='shower' && Number($('hot').value)<Number($('cold').value);
  fields.forEach(e=>e.removeAttribute('aria-invalid'));
  $('guide-error').textContent=bad?'Completa los campos con valores válidos para calcular.':temperatureBad?'La temperatura del agua mezclada no puede ser menor que la del agua fría.':'';
  if(bad||temperatureBad){if(bad)bad.setAttribute('aria-invalid','true');resultIds.forEach(id=>{if($(id))$(id).textContent='—';});return;}
  if(kind==='fridge'){
   const k=Number($('annualKwh').value)*Number($('price').value);
   $('annual').textContent=money(k);$('monthly').textContent=money(k/12);
  }else if(kind==='dryer'){
   const p=Number($('kwh100').value)/100*Number($('price').value);
   $('per').textContent=money(p);$('month').textContent=money(p*Number($('cycles').value)*52/12);
  }else{
   const litres=Number($('people').value)*Number($('showers').value)*52/12*Number($('minutes').value)*Number($('flow').value);
   const kwh=litres*(Number($('hot').value)-Number($('cold').value))*0.001163;
   $('litres').textContent=count(litres,0)+' L';$('kwh').textContent=count(kwh)+' kWh';$('cost').textContent=money(kwh*Number($('price').value))+' / mes';
  }
 }
 fields.forEach(e=>e.addEventListener('input',update));update();
})();
