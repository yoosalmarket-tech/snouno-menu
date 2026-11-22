// A short, soft two-note original chime, synthesized locally with Web Audio.
// No downloaded audio file or tracking. One click plays it and visits Yoosal.
let redirectStarted=false;
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
