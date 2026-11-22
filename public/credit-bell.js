// A short, soft original bell, synthesized locally with Web Audio.
// First click arms a Yoosal credit and changes its color. Second click visits.
let redirectStarted=false;
const creditSelector='#credit-link, .rm-interactive-credit-link';
function resetYoosalCreditStates(){
  redirectStarted=false;
  for(const button of document.querySelectorAll(creditSelector)){
    button.classList.remove('is-armed');
    button.setAttribute('aria-label','زيارة موقع وكالة يوصل');
  }
  // A cached page may return with the interactive credit footer hidden.
  // Restore only when the existing menu has a configured, nonempty credit.
  const richCredit=document.querySelector('#rich-menu .rm-interactive-credit');
  if(richCredit?.dataset.creditConfigured==='1'){
    richCredit.hidden=false;
  }
}
// In both standard loads and back-forward-cache restores, return to yellow.
window.addEventListener('pagehide',resetYoosalCreditStates);
window.addEventListener('pageshow',resetYoosalCreditStates);

export function visitYoosalWithBell(){
 if(redirectStarted)return;
 redirectStarted=true;
 const destination='https://www.yoosal.net/';
 let duration=0;
 try{
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(AudioContextClass){
   const context=new AudioContextClass();
   if(context.state==='suspended')void context.resume().catch(()=>{});
   const origin=context.currentTime+.008;
   const output=context.createGain();
   output.gain.value=.058; // quiet on phones and desktop
   output.connect(context.destination);
   // Gentle, bell-like rising notes, with a rounded fade and no harsh attack.
   for(const [frequency,offset,hold,volume] of [
    [784,.00,.30,.46], [1174.66,.105,.32,.30], [1567.98,.11,.22,.095]
   ]){
    const tone=context.createOscillator();
    const gain=context.createGain();
    tone.type='sine';
    tone.frequency.setValueAtTime(frequency,origin+offset);
    gain.gain.setValueAtTime(.0001,origin+offset);
    gain.gain.exponentialRampToValueAtTime(volume,origin+offset+.018);
    gain.gain.exponentialRampToValueAtTime(.0001,origin+offset+hold);
    tone.connect(gain);
    gain.connect(output);
    tone.start(origin+offset);
    tone.stop(origin+offset+hold+.015);
   }
   duration=450; // let the chime finish before same-tab navigation
  }
 }catch{
  // Even if a browser blocks audio, the destination still opens on this click.
 }
 window.setTimeout(()=>window.location.assign(destination),duration);
}

/**
 * Two-step Yoosal credit interaction, shared by the regular and interactive menus.
 * The first click highlights only the agency name; the second click plays the
 * existing soft bell and navigates. State is scoped to the clicked button.
 */
export function handleYoosalCreditClick(event){
  const button=event.currentTarget;
  if(!button)return;
  if(!button.classList.contains('is-armed')){
    button.classList.add('is-armed');
    button.setAttribute('aria-label','اضغط مرة ثانية لزيارة موقع وكالة يوصل');
    return;
  }
  // Restore yellow on the second click before the bell and navigation.
  button.classList.remove('is-armed');
  button.setAttribute('aria-label','زيارة موقع وكالة يوصل');
  visitYoosalWithBell();
}
