// Modello didattico di una valvola a sfera trunnion 6" Class 300 RF, passaggio pieno.
// Pura: nessun disegno, nessun DOM. La figura legge da qui ogni numero che mostra.
//
// LIMITI (da dire sempre a chi legge la figura):
//  - L'area di passaggio e' il limite della sfera sottile: A/A0 = sin(alpha). Ignora la lunghezza
//    del foro nella sfera, quindi e' una stima per eccesso.
//  - La coppia e' una stima di ordine di grandezza con attrito di Coulomb costante. Non sostituisce
//    il calcolo del costruttore ne' le prove di coppia di API 6D / ISO 14313.
//  - Tutti i parametri sotto sono valori tipici da tarare con i dati del costruttore.

export const DEG = Math.PI / 180;

export const VALVE = {
  nps: 6,
  cls: 300,
  bore: 150, // mm, passaggio pieno
  ftf: 403, // mm, lunghezza fra le facce (API 6D / ASME B16.10, 6" Class 300 RF)
  flangeT: 36, // mm, spessore flangia (indicativo)
  rfOd: 215.9, // mm, diametro della faccia rialzata (B16.5, NPS 6)
  rfHeight: 2, // mm
  bodyMid: 280, // mm, diametro massimo del corpo (indicativo)
  hubOd: 190, // mm, diametro del tronco di corpo vicino alle flange
  stemD: 45, // mm
  packingHeight: 30, // mm
};

export const DUTY = {
  pressureBar: 50, // pressione a monte con valvola chiusa; Class 300 acciaio al carbonio ~ 51 bar a 38 C
  muSeat: 0.12, // attrito sede/sfera (PTFE rinforzato su ENP)
  muPacking: 0.1,
  packingStressMPa: 8, // pressione di contatto della baderna sullo stelo
  seatSealOd: 190, // mm, diametro esterno di tenuta della sede
  seatSealId: 168, // mm, diametro interno di tenuta della sede
  springForceN: 1500, // precarico delle molle di una sede
  armFactor: 0.64, // braccio medio dell'attrito di sede = armFactor * raggio medio di tenuta
};

// Frazione dell'area di passaggio rispetto al passaggio pieno, alpha in radianti (0 chiusa, pi/2 aperta).
export const areaFraction = (alpha) => Math.max(0, Math.sin(alpha));

// Pressione differenziale residua sulla sfera: ipotesi didattica, scende col quadrato dell'area chiusa.
export const residualBar = (alpha, duty = DUTY) => duty.pressureBar * (1 - areaFraction(alpha)) ** 2;

export function torque(alpha, valve = VALVE, duty = DUTY) {
  const dp = residualBar(alpha, duty) * 0.1; // MPa
  const seatArea = (Math.PI / 4) * (duty.seatSealOd ** 2 - duty.seatSealId ** 2); // mm2
  const meanSeatR = (duty.seatSealOd + duty.seatSealId) / 4; // mm
  const arm = duty.armFactor * meanSeatR;
  const seats = duty.muSeat * (2 * duty.springForceN + dp * seatArea) * arm; // N mm
  const packing = duty.muPacking * Math.PI * valve.stemD * valve.packingHeight * duty.packingStressMPa * (valve.stemD / 2); // N mm
  // Primo distacco: l'attrito statico supera quello dinamico finche' la sfera non e' partita.
  const breakaway = 1 + 0.3 * Math.exp(-(alpha / DEG) / 5);
  return ((seats + packing) * breakaway) / 1000; // N m
}

// Il testo della lettura: lo stesso nella pagina e nel file costruito.
export function readoutOf(alpha, valve = VALVE, duty = DUTY) {
  const deg = Math.round(alpha / DEG);
  const state = deg <= 0 ? "chiusa" : deg >= 90 ? "aperta" : `${deg}°`;
  return `${state} · passaggio ${Math.round(areaFraction(alpha) * 100)} % · coppia ~${Math.round(torque(alpha, valve, duty))} N·m`;
}
