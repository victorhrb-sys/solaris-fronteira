export function initLanding(online){
 const landing=document.querySelector('#landing');
 const surfaces=[...document.body.children].filter(el=>el!==landing&&!['SCRIPT','LINK'].includes(el.tagName));
 const show=visible=>{landing.hidden=!visible;surfaces.forEach(el=>{el.inert=visible;});if(visible)landing.focus();};
 const home=document.createElement('button');home.className='landing-home';home.textContent='←';home.title='Voltar ao início';home.setAttribute('aria-label','Voltar ao início');document.querySelector('.topbar').prepend(home);
 home.onclick=()=>show(true);
 document.querySelector('#landingSingle').onclick=()=>{if(online.busy)return;if(online.room)online.leave();show(false);document.querySelector('#advance').focus();};
 document.querySelector('#landingMulti').onclick=()=>{show(false);online.open();};
 document.addEventListener('keydown',e=>{if(!landing.hidden){e.stopImmediatePropagation();}},true);
 show(!new URLSearchParams(location.search).has('room'));
}
